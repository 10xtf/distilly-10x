import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  briefMaterialRefSchema,
  BUILTIN_HOSTS,
  DistillyError,
  facetPathSchema,
  requestIdSchema,
} from "@distilly/protocol";
import type {
  CommitInput,
  EngineClient,
  EngineEvent,
  IngestInput,
  IsoDateTime,
  RequestId,
  SubjectId,
} from "@distilly/protocol";
import { afterEach, describe, expect, it } from "vitest";

import { openPreviewLocalRuntime, type PreviewLocalRuntime } from "./preview.js";

const AT = "2026-08-31T20:00:00.000Z" as IsoDateTime;
const FIRST_REF = briefMaterialRefSchema.parse("m001");
const IDENTITY = facetPathSchema.parse("identity");
const CAPACITY = {
  maximumInputTokens: 4_194_304,
  maximumToolResultBytes: 4_194_304,
  source: "sdk_explicit" as const,
};

const roots: string[] = [];
const runtimes: PreviewLocalRuntime[] = [];
let requestCounter = 100;

const request = (): RequestId =>
  requestIdSchema.parse(`req_${(requestCounter++).toString(16).padStart(32, "0")}`);

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-preview-runtime-"));
  roots.push(root);
  return root;
};

const open = async (root: string): Promise<PreviewLocalRuntime> => {
  const runtime = await openPreviewLocalRuntime({ root });
  runtimes.push(runtime);
  return runtime;
};

const close = async (runtime: PreviewLocalRuntime): Promise<void> => {
  await runtime.close();
  const index = runtimes.indexOf(runtime);
  if (index !== -1) runtimes.splice(index, 1);
};

const connect = (
  runtime: PreviewLocalRuntime,
  id: string,
  withCapacity = true,
): Promise<EngineClient> =>
  runtime.connectTrusted({
    actor: { kind: "sdk", id },
    ...(withCapacity ? { capacity: CAPACITY } : {}),
  });

const material = (subjectId: SubjectId): IngestInput => ({
  subject: { kind: "existing", subjectId },
  materials: [
    {
      clientRef: "local-note",
      kind: "document",
      content: "Mira builds reliable local-first systems and explains evidence precisely.",
      source: {
        uri: "https://example.test/local/mira.md",
        medium: "document",
        access: "private",
        role: "first_party_expression",
        capturedAt: AT,
      },
      derivation: { kind: "native_text" },
      sensitivity: "private",
    },
  ],
  enqueue: "now",
});

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.close()));
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("Developer Preview LocalRuntime", () => {
  it("runs create, ingest, pending, capacity-bound brief, owner-bound commit, get, and prompt", async () => {
    const runtime = await open(await temporaryRoot());
    const noCapacity = await connect(runtime, "no-capacity", false);
    const first = await connect(runtime, "first-client");
    const second = await connect(runtime, "second-client");

    const subject = await first.call(
      "subjects.create",
      {
        displayName: "Mira Chen",
        aliases: ["Mira"],
        domainPack: "colleague",
        identityHints: [{ kind: "url", value: "https://example.test/mira" }],
      },
      { requestId: request() },
    );
    const ingested = await first.call("materials.ingest", material(subject.id), {
      requestId: request(),
    });
    expect(ingested.kind).toBe("ingested");
    if (ingested.kind !== "ingested" || ingested.job === undefined) {
      throw new Error("Expected an enqueued material generation.");
    }

    const pending = await first.call("distill.pending", { subjectId: subject.id });
    expect(pending).toHaveLength(1);
    await expect(
      noCapacity.call("distill.brief", { jobId: ingested.job.id }, { requestId: request() }),
    ).rejects.toMatchObject({ code: "host_unsupported" });

    const briefing = await first.call(
      "distill.brief",
      { jobId: ingested.job.id },
      { requestId: request() },
    );
    expect(briefing.limits.maximumInputTokens).toBe(CAPACITY.maximumInputTokens);
    await expect(
      second.call(
        "distill.release",
        { jobId: briefing.job.id, leaseId: briefing.lease.id },
        { requestId: request() },
      ),
    ).rejects.toMatchObject({ code: "lease_conflict" });

    const patch: CommitInput["patch"] = {
      operations: [
        {
          op: "add",
          claim: {
            facet: IDENTITY,
            text: "Mira builds reliable local-first systems.",
            evidence: [
              {
                kind: "brief_material",
                materialRef: FIRST_REF,
                quote: "Mira builds reliable local-first systems",
              },
            ],
          },
        },
      ],
    };
    const committed = await first.call(
      "distill.commit",
      {
        jobId: briefing.job.id,
        generation: briefing.job.generation,
        leaseId: briefing.lease.id,
        briefContractDigest: briefing.contract.digest,
        materialSetHash: briefing.job.materialSetHash,
        patch,
      },
      { requestId: request() },
    );
    expect(committed.kind).toBe("current");
    const profile = await first.call("profiles.get", { subjectId: subject.id });
    expect(profile.rendered).toContain("Mira builds reliable local-first systems");
    await expect(first.call("profiles.prompt", { subjectId: subject.id })).resolves.toContain(
      profile.rendered,
    );
  });

  it("keeps client watches and closes isolated while the runtime remains usable", async () => {
    const runtime = await open(await temporaryRoot());
    const first = await connect(runtime, "watch-first");
    const second = await connect(runtime, "watch-second");
    const firstEvents: string[] = [];
    const secondEvents: string[] = [];
    await first.watch((event) => firstEvents.push(event.kind));
    await second.watch((event) => secondEvents.push(event.kind));

    await first.close();
    await second.call(
      "subjects.create",
      { displayName: "Watch Subject", identityHints: [] },
      { requestId: request() },
    );

    expect(firstEvents).toEqual([]);
    expect(secondEvents).toEqual(["subject.created"]);
    await expect(first.call("subjects.list", {})).rejects.toMatchObject({ code: "busy" });
    await expect(second.call("subjects.list", {})).resolves.toMatchObject({ items: [{}] });
  });

  it("drains a real in-flight post-commit observer before closing and rejects later calls", async () => {
    const runtime = await open(await temporaryRoot());
    const client = await connect(runtime, "drain-client");
    let entered!: () => void;
    const handlerEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const blockingHandler = (() => {
      entered();
      return blocked;
    }) as unknown as (event: EngineEvent) => void;
    await client.watch(blockingHandler);

    const mutation = client.call(
      "subjects.create",
      { displayName: "Drain Subject", identityHints: [] },
      { requestId: request() },
    );
    await handlerEntered;
    let closed = false;
    const closing = runtime.close().then(() => {
      closed = true;
    });
    await Promise.resolve();
    expect(closed).toBe(false);

    release();
    await mutation;
    await closing;
    const index = runtimes.indexOf(runtime);
    if (index !== -1) runtimes.splice(index, 1);
    await expect(client.call("subjects.list", {})).rejects.toMatchObject({ code: "busy" });
    await expect(connect(runtime, "late-client")).rejects.toMatchObject({ code: "busy" });
  });

  it("persists across close/reopen and parses runtime-owned disabled methods", async () => {
    const root = await temporaryRoot();
    const firstRuntime = await open(root);
    const first = await connect(firstRuntime, "persist-first");
    const subject = await first.call(
      "subjects.create",
      { displayName: "Persistent Subject", identityHints: [] },
      { requestId: request() },
    );

    await expect(
      first.call("hosts.install", { subjectId: subject.id } as never, {
        requestId: request(),
      }),
    ).rejects.toMatchObject({ code: "invalid_input", retryable: false });
    const unsupported = first.call(
      "hosts.install",
      { subjectId: subject.id, host: BUILTIN_HOSTS.codex },
      { requestId: request() },
    );
    await expect(unsupported).rejects.toBeInstanceOf(DistillyError);
    await expect(unsupported).rejects.toMatchObject({
      code: "schema_unsupported",
      retryable: false,
      message: "hosts.install is not enabled in Distilly 0.1 Developer Preview.",
    });

    await close(firstRuntime);
    const reopened = await open(root);
    const second = await connect(reopened, "persist-second");
    await expect(second.call("subjects.list", {})).resolves.toMatchObject({
      items: [{ id: subject.id, displayName: "Persistent Subject" }],
    });
  });
});
