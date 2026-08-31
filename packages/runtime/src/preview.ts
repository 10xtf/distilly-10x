import { readFile, stat } from "node:fs/promises";
import { basename, extname } from "node:path";

import { createBuiltinParserRegistry } from "@distilly/adapters";
import type { ParsedMaterial } from "@distilly/adapters";
import { openPreviewEngine, type PreviewEngineRuntime } from "@distilly/engine/preview";
import {
  DistillyError,
  WIRE_LIMITS,
  engineMethodSchemas,
  isoDateTimeSchema,
  mutationContextSchema,
} from "@distilly/protocol";
import type {
  ActorContext,
  BriefCapacity,
  CoreEngineClient,
  CoreMethodName,
  EngineClient,
  EngineEvent,
  EngineMethodMap,
  MutationContext,
  MutationMethodName,
  QueryMethodName,
  RequestId,
  RuntimeOwnedMethodName,
  SubjectId,
  Unsubscribe,
} from "@distilly/protocol";

type DynamicCoreCall = (
  method: CoreMethodName,
  params: unknown,
  context?: MutationContext,
) => Promise<unknown>;

const localClientClosed = (): DistillyError =>
  new DistillyError({
    code: "busy",
    message: "The Developer Preview LocalRuntime client is closed.",
    retryable: false,
  });

const localRuntimeClosed = (): DistillyError =>
  new DistillyError({
    code: "busy",
    message: "The Developer Preview LocalRuntime is closing or closed.",
    retryable: false,
  });

const previewUnsupported = (method: RuntimeOwnedMethodName): DistillyError =>
  new DistillyError({
    code: "schema_unsupported",
    message: `${method} is not enabled in Distilly 0.1 Developer Preview.`,
    retryable: false,
    remediation: "Use a method enabled by the 0.1 Developer Preview.",
  });

const invalidBoundary = (label: string): DistillyError =>
  new DistillyError({
    code: "invalid_input",
    message: `Invalid Developer Preview ${label}.`,
    retryable: false,
  });

const mediaTypeForPath = (path: string): string => {
  switch (extname(path).toLowerCase()) {
    case ".txt":
      return "text/plain";
    case ".md":
    case ".markdown":
      return "text/markdown";
    case ".json":
      return "application/json";
    case ".srt":
      return "application/x-subrip";
    case ".vtt":
      return "text/vtt";
    default:
      return "application/octet-stream";
  }
};

const parserWarning = (error: unknown): string => {
  if (error instanceof DistillyError && error.code === "context_too_large") {
    return "Parsed text exceeds the local material limit; narrow the file and try again.";
  }
  if (error instanceof DistillyError && error.code === "invalid_input") {
    return "The local file could not be parsed as valid text for its format.";
  }
  return "The local parser could not extract text from this file.";
};

const createLocalFileLoader = () => {
  const registry = createBuiltinParserRegistry();
  return {
    async load(input: {
      readonly paths: readonly string[];
      readonly subjectId: SubjectId;
      readonly requestId: RequestId;
      readonly sensitivity: "private" | "shareable";
    }) {
      return Promise.all(
        input.paths.map(async (path, index) => {
          const pathLabel = basename(path);
          if (pathLabel.length === 0 || pathLabel === "." || pathLabel === "..") {
            throw invalidBoundary(`materials.ingestFiles paths[${String(index)}]`);
          }
          let bytes: Uint8Array;
          let modifiedAt: Date;
          try {
            const metadata = await stat(path);
            if (!metadata.isFile()) throw new Error("not a regular file");
            bytes = Uint8Array.from(await readFile(path));
            modifiedAt = metadata.mtime;
          } catch {
            throw new DistillyError({
              code: "invalid_input",
              message: "A selected local file could not be read.",
              retryable: false,
              fieldPath: `paths[${String(index)}]`,
            });
          }
          const mediaType = mediaTypeForPath(path);
          const source = {
            title: pathLabel,
            medium:
              mediaType === "application/x-subrip" || mediaType === "text/vtt"
                ? ("video" as const)
                : ("document" as const),
            access: "private" as const,
            capturedAt: isoDateTimeSchema.parse(modifiedAt.toISOString()),
          };
          const parser = registry.select(mediaType);
          if (parser === undefined) {
            return {
              pathLabel,
              mediaType,
              bytes,
              source,
              warnings: ["No deterministic local parser supports this file format."],
            };
          }
          let parsed: ParsedMaterial;
          try {
            parsed = await parser.parse(
              { clientRef: pathLabel, mediaType, bytes, source },
              {
                subjectId: input.subjectId,
                requestId: input.requestId,
                maximumOutputBytes: WIRE_LIMITS.materialContentBytes,
              },
            );
          } catch (error) {
            return { pathLabel, mediaType, bytes, source, warnings: [parserWarning(error)] };
          }
          return {
            pathLabel,
            mediaType,
            bytes,
            source,
            ...(parsed.material === undefined
              ? {}
              : { parsed: { ...parsed.material, sensitivity: input.sensitivity } }),
            warnings: parsed.warnings,
          };
        }),
      );
    },
  };
};

const parseRuntimeParams = <M extends RuntimeOwnedMethodName>(
  method: M,
  value: unknown,
): EngineMethodMap[M]["params"] => {
  try {
    return engineMethodSchemas[method].params.parse(value);
  } catch {
    throw invalidBoundary(`${method} params`);
  }
};

const parseRuntimeMutation = (value: unknown): MutationContext => {
  try {
    return mutationContextSchema.parse(value);
  } catch {
    throw invalidBoundary("mutation context");
  }
};

/** Trusted session identity accepted by the local Developer Preview runtime. */
export interface PreviewTrustedSessionOptions {
  readonly actor: ActorContext;
  readonly capacity?: BriefCapacity;
}

/** Root configuration for the local Developer Preview runtime. */
export interface OpenPreviewLocalRuntimeOptions {
  readonly root: string;
}

/** Explicit Developer Preview composition of local Engine core methods. */
export interface PreviewLocalRuntime {
  /**
   * Binds one trusted actor and verified capacity to a full typed client.
   *
   * @param options - Trusted identity and optional capacity from a binding.
   * @returns An EngineClient whose disabled Preview methods fail visibly.
   */
  connectTrusted(options: PreviewTrustedSessionOptions): Promise<EngineClient>;

  /**
   * Drains local calls and closes the owned Engine runtime.
   *
   * @returns Completion after all local resources close.
   */
  close(): Promise<void>;
}

interface PreviewLocalClientDependencies {
  readonly core: CoreEngineClient;
  readonly run: <T>(operation: () => Promise<T>) => Promise<T>;
  readonly onClose: (client: PreviewLocalClient) => void;
}

class PreviewLocalClient implements EngineClient {
  readonly #core: CoreEngineClient;
  readonly #callCore: DynamicCoreCall;
  readonly #run: PreviewLocalClientDependencies["run"];
  readonly #onClose: PreviewLocalClientDependencies["onClose"];
  #closed = false;
  #closePromise: Promise<void> | undefined;

  constructor(dependencies: PreviewLocalClientDependencies) {
    this.#core = dependencies.core;
    this.#callCore = this.#core.call.bind(this.#core);
    this.#run = dependencies.run;
    this.#onClose = dependencies.onClose;
  }

  /** Calls one core method or a visibly disabled runtime-owned Preview method. */
  call<M extends QueryMethodName>(
    method: M,
    params: EngineMethodMap[M]["params"],
  ): Promise<EngineMethodMap[M]["result"]>;
  call<M extends MutationMethodName>(
    method: M,
    params: EngineMethodMap[M]["params"],
    context: MutationContext,
  ): Promise<EngineMethodMap[M]["result"]>;
  async call(
    method: keyof EngineMethodMap,
    params: unknown,
    context?: MutationContext,
  ): Promise<unknown> {
    this.#assertOpen();
    return this.#run(async () => {
      if (method === "hosts.install" || method === "hosts.uninstall" || method === "hosts.export") {
        parseRuntimeParams(method, params);
        parseRuntimeMutation(context);
        throw previewUnsupported(method);
      }
      if (method === "system.doctor") {
        parseRuntimeParams(method, params);
        throw previewUnsupported(method);
      }
      return this.#callCore(method, params, context);
    });
  }

  /**
   * Subscribes through the owned core session.
   *
   * @param handler - Post-commit invalidation callback.
   * @returns The core session's unsubscribe callback.
   */
  async watch(handler: (event: EngineEvent) => void): Promise<Unsubscribe> {
    this.#assertOpen();
    return this.#run(() => this.#core.watch(handler));
  }

  /**
   * Detaches this wrapper and its core session without closing LocalRuntime.
   *
   * @returns Completion after this session's watches detach.
   */
  close(): Promise<void> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    this.#closed = true;
    this.#onClose(this);
    this.#closePromise = this.#core.close();
    return this.#closePromise;
  }

  /**
   * Detaches this wrapper when its owning LocalRuntime closes.
   *
   * @returns Completion after the core client detaches.
   */
  detachFromRuntime(): Promise<void> {
    return this.close();
  }

  #assertOpen(): void {
    if (this.#closed) throw localClientClosed();
  }
}

class PreviewLocalRuntimeImplementation implements PreviewLocalRuntime {
  readonly #engine: PreviewEngineRuntime;
  readonly #clients = new Set<PreviewLocalClient>();
  readonly #inFlight = new Set<Promise<unknown>>();
  #accepting = true;
  #closePromise: Promise<void> | undefined;

  constructor(engine: PreviewEngineRuntime) {
    this.#engine = engine;
  }

  /**
   * Binds one trusted LocalRuntime client to a fresh Engine session.
   *
   * @param options - Trusted actor and optional verified capacity.
   * @returns The full typed Preview client.
   */
  async connectTrusted(options: PreviewTrustedSessionOptions): Promise<EngineClient> {
    return this.#run(async () => {
      const core = await this.#engine.connect(options);
      const client = new PreviewLocalClient({
        core,
        run: (operation) => this.#run(operation),
        onClose: (closed) => this.#clients.delete(closed),
      });
      this.#clients.add(client);
      return client;
    });
  }

  /**
   * Drains local calls, detaches wrappers, and closes the Engine once.
   *
   * @returns Completion after all local resources close.
   */
  close(): Promise<void> {
    if (this.#closePromise !== undefined) return this.#closePromise;
    this.#accepting = false;
    this.#closePromise = (async () => {
      await Promise.allSettled([...this.#inFlight]);
      await Promise.all([...this.#clients].map((client) => client.detachFromRuntime()));
      await this.#engine.close();
    })();
    return this.#closePromise;
  }

  #run<T>(operation: () => Promise<T>): Promise<T> {
    if (!this.#accepting) throw localRuntimeClosed();
    const pending = Promise.resolve().then(operation);
    this.#inFlight.add(pending);
    void pending.then(
      () => this.#inFlight.delete(pending),
      () => this.#inFlight.delete(pending),
    );
    return pending;
  }
}

/**
 * Opens the local 0.1 Developer Preview runtime over one Distilly root.
 *
 * @param options - Local root owned by the composed Engine runtime.
 * @returns The opened LocalRuntime.
 */
export const openPreviewLocalRuntime = async (
  options: OpenPreviewLocalRuntimeOptions,
): Promise<PreviewLocalRuntime> => {
  const engine = await openPreviewEngine({ ...options, fileLoader: createLocalFileLoader() });
  return new PreviewLocalRuntimeImplementation(engine);
};
