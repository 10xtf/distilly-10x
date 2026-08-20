import { DatabaseSync } from "node:sqlite";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  requestIdSchema,
  subjectStateRecordSchema,
  type ActorContext,
  type IngestInput,
  type IngestResult,
  type IsoDateTime,
  type RequestId,
  type SubjectId,
  type SubjectStateRecord,
} from "@distilly/protocol";

import { Layout } from "../layout.js";
import type { SqliteQueueRepositoryHooks } from "../queue/sqlite-projection.js";
import { sealFact } from "../facts/checksum.js";
import { createStep6Composition } from "./composition.js";

const CAPTURED_AT = "2026-08-20T10:30:00.000Z" as IsoDateTime;
const DIRTY_BYTES = '{"projection":"queue","schemaVersion":2}\n';
const ACTOR: ActorContext = { kind: "sdk", id: "queue-recovery-integration" };
const roots: string[] = [];

interface QueueRow {
  readonly subject_id: string;
  readonly job_id: string;
  readonly generation: number;
}

const request = (digit: number): RequestId =>
  requestIdSchema.parse(`req_${digit.toString(16).padStart(32, "0")}`);

const material = (digit: number): IngestInput["materials"][number] => ({
  clientRef: `queue-source-${digit}`,
  kind: "web",
  content: `Queue recovery source ${digit}.`,
  source: {
    uri: `https://example.com/queue-source-${digit}`,
    medium: "article",
    access: "public",
    role: "reference",
    capturedAt: CAPTURED_AT,
  },
  derivation: { kind: "native_text" },
});

const createInput = (): IngestInput => ({
  subject: {
    kind: "create",
    input: {
      displayName: "Queue Recovery Subject",
      identityHints: [{ kind: "url", value: "https://example.com/queue-recovery-subject" }],
    },
  },
  materials: [material(1)],
  enqueue: "now",
});

const existingInput = (subjectId: SubjectId): IngestInput => ({
  subject: { kind: "existing", subjectId },
  materials: [material(2)],
  enqueue: "now",
});

const makeRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-composition-queue-"));
  roots.push(root);
  return root;
};

const open = (root: string, queueHooks?: SqliteQueueRepositoryHooks) =>
  createStep6Composition({
    root,
    ...(queueHooks === undefined ? {} : { queueHooks }),
  });

const queueRows = (root: string): readonly QueueRow[] => {
  const database = new DatabaseSync(new Layout(root).queueDatabaseFile(), { readOnly: true });
  try {
    return database
      .prepare("SELECT subject_id, job_id, generation FROM queue_jobs ORDER BY subject_id")
      .all() as unknown as readonly QueueRow[];
  } finally {
    database.close();
  }
};

const readState = async (root: string, subjectId: SubjectId): Promise<SubjectStateRecord> => {
  const raw: unknown = JSON.parse(await readFile(new Layout(root).stateFile(subjectId), "utf8"));
  return subjectStateRecordSchema.parse(raw) as SubjectStateRecord;
};

const requireQueued = (result: IngestResult): NonNullable<IngestResult["job"]> => {
  expect(result.job).toBeDefined();
  return result.job!;
};

const createQueuedSubject = async (root: string) => {
  const composition = await open(root);
  const result = await composition.ingest.ingest(createInput(), ACTOR, {
    requestId: request(1),
  });
  return { result, job: requireQueued(result) };
};

const mutateDatabase = (path: string, mutate: (database: DatabaseSync) => void): void => {
  const database = new DatabaseSync(path);
  try {
    mutate(database);
  } finally {
    database.close();
  }
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("Step 5 queue projection composition recovery", { timeout: 15_000 }, () => {
  it.each([
    [
      "exact dirty marker",
      async (layout: Layout) => writeFile(layout.queueDirtyFile(), DIRTY_BYTES, { mode: 0o600 }),
    ],
    [
      "malformed dirty marker",
      async (layout: Layout) =>
        writeFile(layout.queueDirtyFile(), '{"projection":"queue"}\n', { mode: 0o600 }),
    ],
    ["deleted database", async (layout: Layout) => unlink(layout.queueDatabaseFile())],
    [
      "corrupt database",
      async (layout: Layout) =>
        writeFile(layout.queueDatabaseFile(), "not sqlite", { mode: 0o600 }),
    ],
    [
      "incompatible schema version",
      (layout: Layout) => {
        mutateDatabase(layout.queueDatabaseFile(), (database) => {
          database.exec("PRAGMA user_version = 1");
        });
      },
    ],
    [
      "invalid queue row",
      (layout: Layout) => {
        mutateDatabase(layout.queueDatabaseFile(), (database) => {
          database.prepare("UPDATE queue_jobs SET job_id = 'bad'").run();
        });
      },
    ],
  ] as const)(
    "rebuilds a %s from authoritative facts without changing JobId",
    async (_kind, damage) => {
      const root = await makeRoot();
      const { result, job } = await createQueuedSubject(root);
      const before = await readState(root, result.subject.id);
      await damage(new Layout(root));

      await open(root);

      const after = await readState(root, result.subject.id);
      expect(after).toEqual(before);
      expect(after.pending?.jobId).toBe(job.id);
      expect(queueRows(root)).toEqual([
        expect.objectContaining({ subject_id: result.subject.id, job_id: job.id }),
      ]);
    },
  );

  it("fails closed instead of rebuilding from an invalid pending baseline count", async () => {
    const root = await makeRoot();
    const { result } = await createQueuedSubject(root);
    const layout = new Layout(root);
    const state = await readState(root, result.subject.id);
    if (state.pending === undefined) throw new Error("Expected pending work in the state fixture.");
    const invalid = sealFact<SubjectStateRecord>({
      ...state,
      pending: { ...state.pending, addedMaterialCount: 0 },
    });
    await writeFile(layout.stateFile(result.subject.id), `${JSON.stringify(invalid)}\n`, {
      mode: 0o600,
    });
    await unlink(layout.queueDatabaseFile());

    await expect(open(root)).rejects.toMatchObject({ code: "storage_corrupt" });
    await expect(readState(root, result.subject.id)).resolves.toEqual(invalid);
  });

  it.each([
    "afterDirtyMarker",
    "afterApplyCommit",
    "afterApplyDatabaseSync",
    "afterDirtyMarkerUnlink",
  ] as const)(
    "recovers an apply crash at %s from facts without changing the target JobId",
    async (point) => {
      const root = await makeRoot();
      const { result: created, job: previousJob } = await createQueuedSubject(root);
      const input = existingInput(created.subject.id);
      const crashed = await open(root, {
        [point]() {
          throw new Error(`injected queue crash at ${point}`);
        },
      });

      await expect(
        crashed.ingest.ingest(input, ACTOR, { requestId: request(2) }),
      ).rejects.toMatchObject({ code: "index_unavailable" });
      const committedFact = await readState(root, created.subject.id);
      expect(committedFact.materialManifest).toHaveLength(2);
      expect(committedFact.pending?.jobId).toBeDefined();
      expect(committedFact.pending?.jobId).not.toBe(previousJob.id);
      await expect(readFile(new Layout(root).queueDirtyFile(), "utf8")).resolves.toBe(DIRTY_BYTES);

      const recovered = await open(root);
      const replay = await recovered.ingest.ingest(input, ACTOR, { requestId: request(2) });
      const targetJob = requireQueued(replay);
      expect(targetJob.id).toBe(committedFact.pending?.jobId);
      expect(await readState(root, created.subject.id)).toEqual(committedFact);
      expect(queueRows(root)).toEqual([
        expect.objectContaining({ subject_id: created.subject.id, job_id: targetJob.id }),
      ]);
    },
  );

  it("recovers an atomically replaced rebuild after its parent sync without changing facts", async () => {
    const root = await makeRoot();
    const { result, job } = await createQueuedSubject(root);
    const before = await readState(root, result.subject.id);
    const layout = new Layout(root);
    await unlink(layout.queueDatabaseFile());

    await expect(
      open(root, {
        afterRebuildReplaceSync() {
          throw new Error("injected queue rebuild crash after replacement sync");
        },
      }),
    ).rejects.toMatchObject({ code: "index_unavailable" });
    expect(await readState(root, result.subject.id)).toEqual(before);
    await expect(readFile(layout.queueDirtyFile(), "utf8")).resolves.toBe(DIRTY_BYTES);
    expect(queueRows(root)).toEqual([
      expect.objectContaining({ subject_id: result.subject.id, job_id: job.id }),
    ]);

    await open(root);
    expect(await readState(root, result.subject.id)).toEqual(before);
    expect(queueRows(root)).toEqual([
      expect.objectContaining({ subject_id: result.subject.id, job_id: job.id }),
    ]);
  });
});
