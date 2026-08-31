import { openPreviewEngine, type PreviewEngineRuntime } from "@distilly/engine/preview";
import { DistillyError, engineMethodSchemas, mutationContextSchema } from "@distilly/protocol";
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
  RuntimeOwnedMethodName,
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
  const engine = await openPreviewEngine(options);
  return new PreviewLocalRuntimeImplementation(engine);
};
