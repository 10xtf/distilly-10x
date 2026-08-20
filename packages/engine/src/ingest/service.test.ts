import { DatabaseSync } from "node:sqlite";
import { mkdir, mkdtemp, readdir, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  BUILTIN_PEOPLE_SPACE_ID,
  DistillyError,
  contentDigestSchema,
  materialIdSchema,
  requestIdSchema,
  transactionRecordSchema,
  versionMaterialManifestSchema,
  versionIdSchema,
  versionRecordSchema,
  type ActorContext,
  type EngineEvent,
  type EventId,
  type IngestInput,
  type IngestTransactionRecord,
  type IsoDateTime,
  type JobId,
  type OperationRecord,
  type RequestId,
  type RuntimeSchema,
  type SpaceId,
  type SubjectId,
  type SubjectStateRecord,
  type VersionMaterialManifest,
  type VersionRecord,
} from "@distilly/protocol";

import { InProcessEventBus } from "../defaults/in-process-event-bus.js";
import type { Clock } from "../defaults/system-clock.js";
import { computeFactChecksum, sealFact } from "../facts/checksum.js";
import { createFactFile, replaceFactFile } from "../facts/fact-file.js";
import { FileMaterialStore } from "../facts/material-store.js";
import { FileOperationStore } from "../facts/operation-store.js";
import { FileSpaceStore } from "../facts/space-store.js";
import { FileStateStore } from "../facts/state-store.js";
import { FileSubjectStore } from "../facts/subject-store.js";
import { FileTransactionStore } from "../facts/transaction-store.js";
import { Layout } from "../layout.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type { RecoveryHooks } from "../transaction/recovery.js";
import { createStep5IngestComposition } from "./composition.js";
import type { Step5IngestComposition } from "./composition.js";
import type { IngestServiceHooks } from "./service.js";

const AT = "2026-08-20T10:30:00.000Z" as IsoDateTime;
const ACTOR: ActorContext = { kind: "sdk", id: "step5-integration" };
const QUALITY = {
  sourceGroupingVersion: "source-groups-v1",
  activeClaimCount: 0,
  contestedClaimCount: 0,
  userAssertedClaimCount: 0,
  corroboratedClaimCount: 0,
  sourceGroupCount: 1,
  diversityEligibleSourceGroupCount: 1,
  unknownSourceGroupCount: 0,
  coveredCoreFacets: ["identity"],
  uncoveredCoreFacets: ["voice", "psyche", "relations", "boundaries", "texture", "timeline"],
  maturity: "forming",
} as const;
const VERSION_SCHEMA: RuntimeSchema<VersionRecord> = {
  parse(value) {
    return versionRecordSchema.parse(value) as VersionRecord;
  },
};
const VERSION_MANIFEST_SCHEMA: RuntimeSchema<VersionMaterialManifest> = {
  parse(value) {
    return versionMaterialManifestSchema.parse(value);
  },
};
const TRANSACTION_SCHEMA: RuntimeSchema<IngestTransactionRecord> = {
  parse(value) {
    return transactionRecordSchema.parse(value) as IngestTransactionRecord;
  },
};
const roots: string[] = [];

class FakeClock implements Clock {
  current = AT;

  now(): IsoDateTime {
    return this.current;
  }
}

class SequenceIds implements IdGenerator {
  private subject = 1;
  private space = 1;
  private job = 1;
  private event = 1;

  subjectId(): SubjectId {
    return `subject_${(this.subject++).toString(16).padStart(32, "0")}` as SubjectId;
  }

  spaceId(): SpaceId {
    return `space_${(this.space++ + 1).toString(16).padStart(32, "0")}` as SpaceId;
  }

  jobId(): JobId {
    return `job_${(this.job++).toString(16).padStart(32, "0")}` as JobId;
  }

  eventId(): EventId {
    return `event_${(this.event++).toString(16).padStart(32, "0")}` as EventId;
  }
}

interface OpenOptions {
  readonly ingestHooks?: IngestServiceHooks;
  readonly recoveryHooks?: RecoveryHooks;
  readonly published?: EngineEvent[];
}

const makeRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-ingest-service-"));
  roots.push(root);
  return root;
};

const request = (digit: number): RequestId =>
  requestIdSchema.parse(`req_${digit.toString(16).padStart(32, "0")}`);

const material = (digit: number): IngestInput["materials"][number] => ({
  clientRef: `source-${digit}`,
  kind: "web",
  content: `Verified source ${digit}.`,
  source: {
    uri: `https://example.com/source-${digit}`,
    medium: "article",
    access: "public",
    role: "reference",
    capturedAt: AT,
  },
  derivation: { kind: "native_text" },
});

const createInput = (materials: IngestInput["materials"] = [material(1)]): IngestInput => ({
  subject: {
    kind: "create",
    input: {
      displayName: "Ada Lovelace",
      aliases: ["Ada"],
      identityHints: [{ kind: "url", value: "https://example.com/ada" }],
    },
  },
  materials,
  enqueue: "now",
});

const inlineCreateInput = (): IngestInput => ({
  subject: {
    kind: "create",
    input: {
      displayName: "Ada Lovelace",
      space: { displayName: "Mathematicians", kind: "custom" },
      identityHints: [{ kind: "url", value: "https://example.com/ada" }],
    },
  },
  materials: [material(1)],
  enqueue: "now",
});

const existingInput = (
  subjectId: SubjectId,
  materials: IngestInput["materials"],
  enqueue: IngestInput["enqueue"] = "now",
): IngestInput => ({ subject: { kind: "existing", subjectId }, materials, enqueue });

const open = async (
  root: string,
  ids: SequenceIds,
  clock: FakeClock,
  options: OpenOptions = {},
): Promise<Step5IngestComposition> => {
  const eventBus = new InProcessEventBus();
  if (options.published !== undefined) {
    eventBus.subscribe((event) => {
      options.published?.push(event);
    });
  }
  return createStep5IngestComposition({
    root,
    ids,
    clock,
    eventBus,
    ...(options.ingestHooks === undefined ? {} : { ingestHooks: options.ingestHooks }),
    ...(options.recoveryHooks === undefined ? {} : { recoveryHooks: options.recoveryHooks }),
  });
};

const stores = (root: string) => {
  const layout = new Layout(root);
  const spaces = new FileSpaceStore(layout);
  const subjects = new FileSubjectStore(layout, spaces);
  const materials = new FileMaterialStore(layout, subjects);
  return {
    layout,
    spaces,
    subjects,
    materials,
    states: new FileStateStore(layout, subjects, materials),
    operations: new FileOperationStore(layout, subjects),
    transactions: new FileTransactionStore(layout),
  };
};

const queueRows = (root: string): readonly Record<string, unknown>[] => {
  const database = new DatabaseSync(new Layout(root).queueDatabaseFile(), { readOnly: true });
  try {
    return database.prepare("SELECT * FROM queue_jobs ORDER BY subject_id").all();
  } finally {
    database.close();
  }
};

const rejectCode = async (promise: Promise<unknown>, code: string): Promise<void> => {
  try {
    await promise;
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(DistillyError);
    expect(error).toMatchObject({ code });
  }
};

const failOnce = (): (() => void) => {
  let failed = false;
  return () => {
    if (failed) return;
    failed = true;
    throw new Error("simulated process crash");
  };
};

const barrier = (): {
  readonly entered: Promise<void>;
  readonly release: () => void;
  readonly wait: () => Promise<void>;
} => {
  let enter!: () => void;
  let release!: () => void;
  const entered = new Promise<void>((resolve) => {
    enter = resolve;
  });
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  return {
    entered,
    release,
    async wait() {
      enter();
      await released;
    },
  };
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Step 5 atomic ingest composition", { timeout: 15_000 }, () => {
  it("creates the first subject/material/state/job atomically and replays one exact result", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const published: EngineEvent[] = [];
    const composition = await open(root, ids, clock, { published });
    const input = createInput();
    const result = await composition.ingest.ingest(input, ACTOR, { requestId: request(1) });

    expect(result).toMatchObject({
      kind: "ingested",
      created: true,
      generation: 1,
      items: [{ clientRef: "source-1", kind: "accepted" }],
      job: { generation: 1, addedMaterialCount: 1, totalMaterialCount: 1 },
    });
    const subjectId = result.subject.id;
    const facts = stores(root);
    expect(await facts.spaces.read(BUILTIN_PEOPLE_SPACE_ID)).toMatchObject({
      displayName: "People",
      kind: "people",
    });
    expect(await facts.subjects.read(subjectId)).toMatchObject({ displayName: "Ada Lovelace" });
    const state = await facts.states.read(subjectId);
    expect(state).toMatchObject({ generation: 1, pending: { jobId: result.job?.id } });
    expect(state.materialManifest).toHaveLength(1);
    await expect(
      facts.materials.read(subjectId, state.materialManifest[0]!.materialId),
    ).resolves.toMatchObject({ content: "Verified source 1." });
    await expect(facts.operations.read(request(1))).resolves.toMatchObject({
      recordKind: "completed",
      result,
    });
    await expect(facts.transactions.read(request(1))).resolves.toMatchObject({
      state: "committed",
      subjectId,
    });
    expect(queueRows(root)).toEqual([
      expect.objectContaining({
        subject_id: subjectId,
        job_id: result.job?.id,
        generation: 1,
      }),
    ]);
    expect(published.map((event) => event.kind)).toEqual([
      "subject.created",
      "material.ingested",
      "job.changed",
    ]);

    const replay = await composition.ingest.ingest(input, ACTOR, { requestId: request(1) });
    expect(replay).toEqual(result);
    expect(published).toHaveLength(3);
    const equivalent: IngestInput = {
      subject: {
        kind: "create",
        input: {
          displayName: " Ada Lovelace ",
          aliases: ["Ada", "Ada"],
          identityHints: [{ kind: "url", value: "HTTPS://EXAMPLE.com:443/ada#profile" }],
        },
      },
      materials: [
        {
          ...material(1),
          content: "Verified source 1.  ",
          source: {
            ...material(1).source,
            uri: "HTTPS://EXAMPLE.com:443/source-1#copy",
            authors: [],
          },
          sensitivity: "private",
          flags: [],
          participants: [],
        },
      ],
      enqueue: "now",
    };
    await expect(
      composition.ingest.ingest(equivalent, ACTOR, { requestId: request(1) }),
    ).resolves.toEqual(result);
    await rejectCode(
      composition.ingest.ingest(
        input,
        { ...ACTOR, id: "different-actor" },
        {
          requestId: request(1),
        },
      ),
      "idempotency_conflict",
    );
    await rejectCode(
      composition.ingest.ingest(inlineCreateInput(), ACTOR, { requestId: request(1) }),
      "idempotency_conflict",
    );
  });

  it("adds an existing material, then reports duplicate-only now without replacing the job", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const composition = await open(root, ids, clock);
    const created = await composition.ingest.ingest(createInput(), ACTOR, {
      requestId: request(1),
    });
    const added = await composition.ingest.ingest(
      existingInput(created.subject.id, [material(2)]),
      ACTOR,
      { requestId: request(2) },
    );
    expect(added).toMatchObject({
      kind: "ingested",
      created: false,
      generation: 2,
      job: { generation: 2, addedMaterialCount: 2, totalMaterialCount: 2 },
    });
    expect(added.job?.id).not.toBe(created.job?.id);

    const duplicate = await composition.ingest.ingest(
      existingInput(created.subject.id, [material(2)]),
      ACTOR,
      { requestId: request(3) },
    );
    expect(duplicate).toMatchObject({
      kind: "unchanged",
      generation: 2,
      items: [{ kind: "duplicate" }],
      job: { id: added.job?.id },
    });
    expect(queueRows(root)).toHaveLength(1);
  });

  it("rejects a RequestId already completed by another mutation method", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const composition = await open(root, ids, clock);
    const created = await composition.ingest.ingest(createInput(), ACTOR, {
      requestId: request(1),
    });
    const inputChecksum = computeFactChecksum({
      method: "subjects.archive",
      subjectId: created.subject.id,
    });
    await stores(root).operations.write(
      sealFact<OperationRecord<"subjects.archive">>({
        schemaVersion: 1,
        recordKind: "completed",
        requestId: request(2),
        method: "subjects.archive",
        scope: { kind: "subject", subjectId: created.subject.id },
        actor: ACTOR,
        inputChecksum,
        result: null,
        completedAt: AT,
      }),
    );

    await rejectCode(
      composition.ingest.ingest(existingInput(created.subject.id, [material(2)]), ACTOR, {
        requestId: request(2),
      }),
      "idempotency_conflict",
    );
  });

  it.each([
    ["built-in People", createInput()],
    ["inline space", inlineCreateInput()],
  ])("serializes concurrent duplicate creation in %s", async (_label, input) => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const composition = await open(root, ids, clock);
    const attempts = await Promise.allSettled([
      composition.ingest.ingest(input, ACTOR, { requestId: request(1) }),
      composition.ingest.ingest(input, ACTOR, { requestId: request(2) }),
    ]);
    expect(attempts.filter((attempt) => attempt.status === "fulfilled")).toHaveLength(1);
    const rejected = attempts.find((attempt) => attempt.status === "rejected");
    expect(rejected).toBeDefined();
    if (rejected?.status === "rejected") {
      expect(rejected.reason).toBeInstanceOf(DistillyError);
      if (rejected.reason instanceof DistillyError) {
        expect(["busy", "already_exists"]).toContain(rejected.reason.code);
      }
    }
    expect(await stores(root).subjects.listAll()).toHaveLength(1);
    expect(await stores(root).spaces.list()).toHaveLength(1);
  });

  it("holds the create identity lock until the prepared journal is durable", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const gate = barrier();
    const composition = await open(root, ids, clock, {
      ingestHooks: { beforePrepared: gate.wait },
    });
    const first = composition.ingest.ingest(createInput(), ACTOR, { requestId: request(1) });
    await gate.entered;
    try {
      await rejectCode(
        composition.ingest.ingest(createInput(), ACTOR, { requestId: request(2) }),
        "busy",
      );
    } finally {
      gate.release();
    }
    await expect(first).resolves.toMatchObject({ kind: "ingested", created: true });
  });

  it("holds the existing-subject lock until the prepared journal is durable", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const initial = await open(root, ids, clock);
    const created = await initial.ingest.ingest(createInput(), ACTOR, { requestId: request(1) });
    const gate = barrier();
    const composition = await open(root, ids, clock, {
      ingestHooks: { beforePrepared: gate.wait },
    });
    const first = composition.ingest.ingest(
      existingInput(created.subject.id, [material(2)]),
      ACTOR,
      { requestId: request(2) },
    );
    await gate.entered;
    try {
      await rejectCode(
        composition.ingest.ingest(existingInput(created.subject.id, [material(3)]), ACTOR, {
          requestId: request(3),
        }),
        "busy",
      );
    } finally {
      gate.release();
    }
    await expect(first).resolves.toMatchObject({ kind: "ingested", generation: 2 });
  });

  it("rejects an invalid batch before publishing a space or subject", async () => {
    const root = await makeRoot();
    const composition = await open(root, new SequenceIds(), new FakeClock());
    await rejectCode(
      composition.ingest.ingest({ ...createInput(), materials: [] }, ACTOR, {
        requestId: request(1),
      }),
      "invalid_input",
    );
    expect(await stores(root).spaces.list()).toEqual([]);
    expect(await stores(root).subjects.listAll()).toEqual([]);
  });

  it("treats a published subject without state as corruption before journaling", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const composition = await open(root, ids, clock);
    const created = await composition.ingest.ingest(createInput(), ACTOR, {
      requestId: request(1),
    });
    const facts = stores(root);
    await unlink(facts.layout.stateFile(created.subject.id));

    await rejectCode(
      composition.ingest.ingest(existingInput(created.subject.id, [material(2)]), ACTOR, {
        requestId: request(2),
      }),
      "storage_corrupt",
    );
    await expect(facts.transactions.readOptional(request(2))).resolves.toBeUndefined();
  });

  it("treats a state pointer to a missing current version as corruption before journaling", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const composition = await open(root, ids, clock);
    const created = await composition.ingest.ingest(createInput(), ACTOR, {
      requestId: request(1),
    });
    const facts = stores(root);
    const state = await facts.states.read(created.subject.id);
    await facts.states.write(
      sealFact({
        ...state,
        currentVersionId: versionIdSchema.parse(`version_${"a".repeat(64)}`),
      }),
    );

    await rejectCode(
      composition.ingest.ingest(existingInput(created.subject.id, [material(2)]), ACTOR, {
        requestId: request(2),
      }),
      "storage_corrupt",
    );
    await expect(facts.transactions.readOptional(request(2))).resolves.toBeUndefined();
  });

  it("uses the verified current-version baseline and never queues on elapsed time alone", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const composition = await open(root, ids, clock);
    const created = await composition.ingest.ingest(createInput(), ACTOR, {
      requestId: request(1),
    });
    const facts = stores(root);
    const state = await facts.states.read(created.subject.id);
    const versionId = versionIdSchema.parse(`version_${"b".repeat(64)}`);
    if (state.materialSetHash === undefined) throw new Error("Expected a non-empty material set.");
    const version = sealFact<VersionRecord>({
      schemaVersion: 1,
      id: versionId,
      subjectId: created.subject.id,
      generation: state.generation,
      materialSetHash: state.materialSetHash,
      materialCount: state.materialManifest.length,
      creation: { kind: "renderer_only", sourceVersionId: versionId },
      createdDisposition: "current",
      actor: { kind: "system", id: "step5-integration" },
      quality: QUALITY,
      rendererVersion: "renderer-v1",
      createdAt: AT,
    });
    const manifest = sealFact<VersionMaterialManifest>({
      schemaVersion: 1,
      items: state.materialManifest,
    });
    await createFactFile(
      root,
      facts.layout.versionFile(created.subject.id, versionId),
      version,
      VERSION_SCHEMA,
    );
    await createFactFile(
      root,
      facts.layout.versionMaterialManifestFile(created.subject.id, versionId),
      manifest,
      VERSION_MANIFEST_SCHEMA,
    );
    const committedState = sealFact<SubjectStateRecord>({
      schemaVersion: 1,
      subjectId: state.subjectId,
      generation: state.generation,
      materialSetHash: state.materialSetHash,
      materialManifest: state.materialManifest,
      currentVersionId: versionId,
      ...(state.suspendedVersionId === undefined
        ? {}
        : { suspendedVersionId: state.suspendedVersionId }),
    });
    await facts.states.write(committedState);
    await unlink(facts.layout.queueDatabaseFile());
    await open(root, ids, clock);
    expect(queueRows(root)).toEqual([]);

    clock.current = "2026-08-20T11:00:00.000Z" as IsoDateTime;
    await expect(facts.states.read(created.subject.id)).resolves.toEqual(committedState);
    expect(queueRows(root)).toEqual([]);

    const first = await composition.ingest.ingest(
      existingInput(created.subject.id, [material(2)], "auto"),
      ACTOR,
      { requestId: request(2) },
    );
    const second = await composition.ingest.ingest(
      existingInput(created.subject.id, [material(3)], "auto"),
      ACTOR,
      { requestId: request(3) },
    );
    const third = await composition.ingest.ingest(
      existingInput(created.subject.id, [material(4)], "auto"),
      ACTOR,
      { requestId: request(4) },
    );
    expect(first.job).toBeUndefined();
    expect(second.job).toBeUndefined();
    expect(third.job).toMatchObject({
      baseVersionId: versionId,
      addedMaterialCount: 3,
      totalMaterialCount: 4,
    });
  });

  it.each(["afterPrepared", "afterFactCommit"] as const)(
    "recovers create crashes at %s without changing the original result",
    async (point) => {
      const root = await makeRoot();
      const ids = new SequenceIds();
      const clock = new FakeClock();
      const hook = failOnce();
      const crashed = await open(root, ids, clock, {
        ingestHooks: { [point]: hook },
      });
      const input = createInput();
      await expect(crashed.ingest.ingest(input, ACTOR, { requestId: request(1) })).rejects.toThrow(
        "simulated process crash",
      );
      const prepared = await stores(root).transactions.read(request(1));

      const recovered = await open(root, ids, clock);
      const result = await recovered.ingest.ingest(input, ACTOR, { requestId: request(1) });
      expect(result).toMatchObject({ kind: "ingested", created: true, generation: 1 });
      expect(result.subject.id).toBe(prepared.subjectId);
      expect(await stores(root).subjects.listAll()).toHaveLength(1);
      await expect(stores(root).transactions.read(request(1))).resolves.toMatchObject({
        state: "committed",
      });
    },
  );

  it("fails closed when create recovery finds a partial stable subject directory", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const crashed = await open(root, ids, clock, {
      ingestHooks: { afterPrepared: failOnce() },
    });
    await expect(
      crashed.ingest.ingest(createInput(), ACTOR, { requestId: request(1) }),
    ).rejects.toThrow("simulated process crash");

    const transaction = await stores(root).transactions.read(request(1));
    await mkdir(new Layout(root).subjectDirectory(transaction.subjectId), { mode: 0o700 });

    await rejectCode(open(root, ids, clock), "storage_corrupt");
    await expect(stores(root).transactions.read(request(1))).resolves.toMatchObject({
      state: "prepared",
    });
  });

  it("removes only the journal-owned partial create staging before an exact retry", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const input = createInput();
    const crashed = await open(root, ids, clock, {
      ingestHooks: { afterPrepared: failOnce() },
    });
    await expect(crashed.ingest.ingest(input, ACTOR, { requestId: request(1) })).rejects.toThrow(
      "simulated process crash",
    );
    const facts = stores(root);
    const transaction = await facts.transactions.read(request(1));
    const staging = facts.layout.ingestStagingDirectory(request(1), transaction.subjectId);
    await mkdir(staging, { recursive: true, mode: 0o700 });
    await writeFile(join(staging, "partial"), "partial", { mode: 0o600 });

    const recovered = await open(root, ids, clock);
    await expect(readdir(staging)).rejects.toMatchObject({ code: "ENOENT" });
    const result = await recovered.ingest.ingest(input, ACTOR, { requestId: request(1) });
    expect(result.subject.id).toBe(transaction.subjectId);
  });

  it("keeps an aborted create request bound to its input, actor, and candidate subject", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const input = createInput();
    const crashed = await open(root, ids, clock, {
      ingestHooks: { afterPrepared: failOnce() },
    });
    await expect(crashed.ingest.ingest(input, ACTOR, { requestId: request(1) })).rejects.toThrow(
      "simulated process crash",
    );
    const prepared = await stores(root).transactions.read(request(1));

    const recovered = await open(root, ids, clock);
    await rejectCode(
      recovered.ingest.ingest(createInput([material(2)]), ACTOR, { requestId: request(1) }),
      "idempotency_conflict",
    );
    await rejectCode(
      recovered.ingest.ingest(
        input,
        { ...ACTOR, id: "different-actor" },
        {
          requestId: request(1),
        },
      ),
      "idempotency_conflict",
    );
    const result = await recovered.ingest.ingest(input, ACTOR, { requestId: request(1) });
    expect(result.subject.id).toBe(prepared.subjectId);
  });

  it("completes a duplicate-only prepared no-op target before considering abort", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const initial = await open(root, ids, clock);
    const created = await initial.ingest.ingest(createInput(), ACTOR, {
      requestId: request(1),
    });
    const input = existingInput(created.subject.id, [material(1)]);
    const crashed = await open(root, ids, clock, {
      ingestHooks: { afterPrepared: failOnce() },
    });
    await expect(crashed.ingest.ingest(input, ACTOR, { requestId: request(2) })).rejects.toThrow(
      "simulated process crash",
    );
    const prepared = await stores(root).transactions.read(request(2));
    const before = await stores(root).states.read(created.subject.id);
    expect(prepared.targetStateChecksum).toBe(before.checksum);
    expect(prepared).toMatchObject({ state: "prepared", previousStateChecksum: before.checksum });

    const recovered = await open(root, ids, clock);
    const result = await recovered.ingest.ingest(input, ACTOR, { requestId: request(2) });
    expect(result).toMatchObject({
      kind: "unchanged",
      generation: created.generation,
      job: { id: created.job?.id },
    });
    await expect(stores(root).transactions.read(request(2))).resolves.toMatchObject({
      state: "committed",
    });
    await expect(stores(root).operations.read(request(2))).resolves.toMatchObject({ result });
  });

  it("rejects a committed target whose stored result summary disagrees with facts", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const crashed = await open(root, ids, clock, {
      ingestHooks: { afterFactCommit: failOnce() },
    });
    await expect(
      crashed.ingest.ingest(createInput(), ACTOR, { requestId: request(1) }),
    ).rejects.toThrow("simulated process crash");

    const facts = stores(root);
    const transaction = await facts.transactions.read(request(1));
    const operationPayload = {
      ...transaction.operation,
      result: {
        ...transaction.operation.result,
        subject: { ...transaction.operation.result.subject, displayName: "Forged summary" },
      },
    };
    const operation = {
      ...operationPayload,
      checksum: computeFactChecksum(operationPayload),
    };
    const transactionPayload = { ...transaction, operation };
    await replaceFactFile(
      root,
      facts.layout.transactionFile(request(1)),
      { ...transactionPayload, checksum: computeFactChecksum(transactionPayload) },
      TRANSACTION_SCHEMA,
    );

    await rejectCode(open(root, ids, clock), "storage_corrupt");
    await expect(facts.operations.readOptional(request(1))).resolves.toBeUndefined();
    await expect(facts.transactions.read(request(1))).resolves.toMatchObject({
      state: "prepared",
    });
    await expect(
      readdir(join(facts.layout.subjectDirectory(transaction.subjectId), "events")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects a committed target whose duplicate result is outside the target manifest", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const crashed = await open(root, ids, clock, {
      ingestHooks: { afterFactCommit: failOnce() },
    });
    await expect(
      crashed.ingest.ingest(createInput(), ACTOR, { requestId: request(1) }),
    ).rejects.toThrow("simulated process crash");

    const facts = stores(root);
    const transaction = await facts.transactions.read(request(1));
    const operationPayload = {
      ...transaction.operation,
      result: {
        ...transaction.operation.result,
        items: [
          ...transaction.operation.result.items,
          {
            clientRef: "forged-duplicate",
            kind: "duplicate" as const,
            materialId: materialIdSchema.parse(`mat_${"c".repeat(64)}`),
            contentDigest: contentDigestSchema.parse(`sha256_${"d".repeat(64)}`),
          },
        ],
      },
    };
    const operation = {
      ...operationPayload,
      checksum: computeFactChecksum(operationPayload),
    };
    const transactionPayload = { ...transaction, operation };
    await replaceFactFile(
      root,
      facts.layout.transactionFile(request(1)),
      { ...transactionPayload, checksum: computeFactChecksum(transactionPayload) },
      TRANSACTION_SCHEMA,
    );

    await rejectCode(open(root, ids, clock), "storage_corrupt");
    await expect(facts.operations.readOptional(request(1))).resolves.toBeUndefined();
    await expect(facts.transactions.read(request(1))).resolves.toMatchObject({
      state: "prepared",
    });
  });

  it("removes only journal-owned material after an existing-subject pre-commit crash", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const initial = await open(root, ids, clock);
    const created = await initial.ingest.ingest(createInput(), ACTOR, { requestId: request(1) });
    const hook = failOnce();
    const crashed = await open(root, ids, clock, {
      ingestHooks: { afterMaterialWrite: hook },
    });
    const nextInput = existingInput(created.subject.id, [material(2)]);
    await expect(
      crashed.ingest.ingest(nextInput, ACTOR, { requestId: request(2) }),
    ).rejects.toThrow("simulated process crash");

    const recovered = await open(root, ids, clock);
    const result = await recovered.ingest.ingest(nextInput, ACTOR, { requestId: request(2) });
    expect(result).toMatchObject({ kind: "ingested", generation: 2 });
    expect((await stores(root).states.read(created.subject.id)).materialManifest).toHaveLength(2);
  });

  it("completes an existing-subject target after the state commit point", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const initial = await open(root, ids, clock);
    const created = await initial.ingest.ingest(createInput(), ACTOR, { requestId: request(1) });
    const input = existingInput(created.subject.id, [material(2)]);
    const crashed = await open(root, ids, clock, {
      ingestHooks: { afterFactCommit: failOnce() },
    });
    await expect(crashed.ingest.ingest(input, ACTOR, { requestId: request(2) })).rejects.toThrow(
      "simulated process crash",
    );
    const facts = stores(root);
    await expect(facts.transactions.read(request(2))).resolves.toMatchObject({
      state: "prepared",
    });
    expect((await facts.states.read(created.subject.id)).materialManifest).toHaveLength(2);

    const recovered = await open(root, ids, clock);
    const result = await recovered.ingest.ingest(input, ACTOR, { requestId: request(2) });
    expect(result).toMatchObject({ kind: "ingested", created: false, generation: 2 });
    await expect(facts.transactions.read(request(2))).resolves.toMatchObject({
      state: "committed",
    });
    await expect(facts.operations.read(request(2))).resolves.toMatchObject({ result });
  });

  it("fails closed when an existing-subject state is neither previous nor target", async () => {
    const root = await makeRoot();
    const ids = new SequenceIds();
    const clock = new FakeClock();
    const initial = await open(root, ids, clock);
    const created = await initial.ingest.ingest(createInput(), ACTOR, { requestId: request(1) });
    const facts = stores(root);
    const previous = await facts.states.read(created.subject.id);
    const input = existingInput(created.subject.id, [material(2)]);
    const crashed = await open(root, ids, clock, {
      ingestHooks: { afterPrepared: failOnce() },
    });
    await expect(crashed.ingest.ingest(input, ACTOR, { requestId: request(2) })).rejects.toThrow(
      "simulated process crash",
    );
    const prepared = await facts.transactions.read(request(2));

    if (previous.materialSetHash === undefined) {
      throw new Error("Expected a non-empty previous material set.");
    }
    const thirdState = sealFact<SubjectStateRecord>({
      schemaVersion: 1,
      subjectId: previous.subjectId,
      generation: previous.generation + 1,
      materialSetHash: previous.materialSetHash,
      materialManifest: previous.materialManifest,
      ...(previous.currentVersionId === undefined
        ? {}
        : { currentVersionId: previous.currentVersionId }),
      ...(previous.suspendedVersionId === undefined
        ? {}
        : { suspendedVersionId: previous.suspendedVersionId }),
    });
    expect(thirdState.checksum).not.toBe(previous.checksum);
    expect(thirdState.checksum).not.toBe(prepared.targetStateChecksum);
    await facts.states.write(thirdState);

    await rejectCode(open(root, ids, clock), "storage_corrupt");
    await expect(facts.transactions.read(request(2))).resolves.toMatchObject({
      state: "prepared",
    });
    await expect(facts.operations.readOptional(request(2))).resolves.toBeUndefined();
  });

  it.each(["afterOperation", "afterEvent", "afterQueue"] as const)(
    "idempotently finishes post-commit recovery after %s",
    async (point) => {
      const root = await makeRoot();
      const ids = new SequenceIds();
      const clock = new FakeClock();
      const hook = failOnce();
      const recoveryHooks: RecoveryHooks =
        point === "afterEvent" ? { afterEvent: hook } : { [point]: hook };
      const crashed = await open(root, ids, clock, { recoveryHooks });
      const input = createInput();
      await expect(crashed.ingest.ingest(input, ACTOR, { requestId: request(1) })).rejects.toThrow(
        "simulated process crash",
      );

      const published: EngineEvent[] = [];
      const recovered = await open(root, ids, clock, { published });
      const result = await recovered.ingest.ingest(input, ACTOR, { requestId: request(1) });
      expect(result).toMatchObject({ kind: "ingested", created: true, generation: 1 });
      expect(await stores(root).operations.read(request(1))).toMatchObject({ result });
      expect(await stores(root).transactions.read(request(1))).toMatchObject({
        state: "committed",
      });
      const eventFiles = await readdir(
        join(stores(root).layout.subjectDirectory(result.subject.id), "events"),
      );
      expect(eventFiles).toHaveLength(3);
      expect(queueRows(root)).toEqual([
        expect.objectContaining({ job_id: result.job?.id, subject_id: result.subject.id }),
      ]);
      expect(published.map((event) => event.kind)).toEqual([
        "subject.created",
        "material.ingested",
        "job.changed",
      ]);
    },
  );

  it.each([
    ["deleted", async (layout: Layout) => unlink(layout.queueDatabaseFile())],
    [
      "dirty",
      async (layout: Layout) =>
        writeFile(layout.queueDirtyFile(), '{"projection":"queue","schemaVersion":1}\n', {
          mode: 0o600,
        }),
    ],
    ["corrupt", async (layout: Layout) => writeFile(layout.queueDatabaseFile(), "not sqlite")],
  ] as const)(
    "rebuilds a %s queue database from authoritative pending markers",
    async (_kind, damage) => {
      const root = await makeRoot();
      const ids = new SequenceIds();
      const clock = new FakeClock();
      const composition = await open(root, ids, clock);
      const result = await composition.ingest.ingest(createInput(), ACTOR, {
        requestId: request(1),
      });
      await damage(new Layout(root));

      await open(root, ids, clock);
      expect(queueRows(root)).toEqual([
        expect.objectContaining({ subject_id: result.subject.id, job_id: result.job?.id }),
      ]);
    },
  );
});
