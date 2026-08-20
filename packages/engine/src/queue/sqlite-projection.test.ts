import { DatabaseSync } from "node:sqlite";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  jobIdSchema,
  materialSetHashSchema,
  subjectIdSchema,
  versionIdSchema,
  type PendingJobMarker,
  type SubjectId,
} from "@distilly/protocol";

import {
  SqliteQueueProjection,
  type QueueProjectionSeed,
  type SqliteQueueProjectionHooks,
  type SqliteQueueProjectionPaths,
} from "./sqlite-projection.js";

const DIRTY_BYTES = '{"projection":"queue","schemaVersion":1}\n';
const roots: string[] = [];

interface QueueRow {
  readonly subject_id: string;
  readonly job_id: string;
  readonly generation: number;
  readonly base_version_id: string | null;
  readonly material_set_hash: string;
  readonly added_material_count: number;
  readonly total_material_count: number;
  readonly queued_at: string;
}

const makePaths = async (): Promise<SqliteQueueProjectionPaths> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-queue-projection-"));
  roots.push(root);
  const indexDirectory = join(root, ".index");
  return {
    root,
    indexDirectory,
    databaseFile: join(indexDirectory, "queue.db"),
    dirtyFile: join(indexDirectory, "queue.dirty"),
  };
};

const subject = (digit: string): SubjectId => subjectIdSchema.parse(`subject_${digit.repeat(32)}`);

const pending = (
  digit: string,
  generation: number,
  options: { readonly base?: string; readonly added?: number; readonly total?: number } = {},
): PendingJobMarker => ({
  jobId: jobIdSchema.parse(`job_${digit.repeat(32)}`),
  generation,
  ...(options.base === undefined
    ? {}
    : { baseVersionId: versionIdSchema.parse(`version_${options.base.repeat(64)}`) }),
  materialSetHash: materialSetHashSchema.parse(`set_sha256_${digit.repeat(64)}`),
  addedMaterialCount: options.added ?? 1,
  totalMaterialCount: options.total ?? generation + 1,
  queuedAt: `2026-08-20T00:00:0${generation}.000Z` as PendingJobMarker["queuedAt"],
});

const readRows = (databaseFile: string): readonly QueueRow[] => {
  const database = new DatabaseSync(databaseFile, { readOnly: true });
  try {
    return database
      .prepare(
        `SELECT
          subject_id,
          job_id,
          generation,
          base_version_id,
          material_set_hash,
          added_material_count,
          total_material_count,
          queued_at
        FROM queue_jobs
        ORDER BY subject_id`,
      )
      .all() as unknown as readonly QueueRow[];
  } finally {
    database.close();
  }
};

const readScalar = (databaseFile: string, sql: string): Record<string, unknown> | undefined => {
  const database = new DatabaseSync(databaseFile, { readOnly: true });
  try {
    return database.prepare(sql).get();
  } finally {
    database.close();
  }
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("SQLite queue projection", () => {
  it("creates the frozen schema and validates exact fact-owned marker fields", async () => {
    const paths = await makePaths();
    const seed = { subjectId: subject("1"), pending: pending("2", 1, { base: "3" }) };
    const projection = new SqliteQueueProjection(paths);

    await projection.rebuild([seed]);

    expect(readScalar(paths.databaseFile, "PRAGMA user_version")).toEqual({ user_version: 1 });
    expect(readScalar(paths.databaseFile, "PRAGMA synchronous")).toEqual({ synchronous: 2 });
    expect(readScalar(paths.databaseFile, "PRAGMA journal_mode")).toEqual({
      journal_mode: "delete",
    });
    expect(
      readScalar(
        paths.databaseFile,
        "SELECT strict FROM pragma_table_list WHERE name = 'queue_jobs'",
      ),
    ).toEqual({ strict: 1 });
    expect(readRows(paths.databaseFile)).toEqual([
      {
        subject_id: seed.subjectId,
        job_id: seed.pending.jobId,
        generation: seed.pending.generation,
        base_version_id: seed.pending.baseVersionId,
        material_set_hash: seed.pending.materialSetHash,
        added_material_count: seed.pending.addedMaterialCount,
        total_material_count: seed.pending.totalMaterialCount,
        queued_at: seed.pending.queuedAt,
      },
    ]);
    await expect(projection.verifyAvailable()).resolves.toBeUndefined();

    const malformed = {
      ...seed.pending,
      unexpected: true,
    } as unknown as PendingJobMarker;
    const otherPaths = await makePaths();
    await expect(
      new SqliteQueueProjection(otherPaths).rebuild([
        { subjectId: subject("4"), pending: malformed },
      ]),
    ).rejects.toMatchObject({ code: "storage_corrupt" });
    await expect(exists(otherPaths.databaseFile)).resolves.toBe(false);
    await expect(exists(otherPaths.dirtyFile)).resolves.toBe(false);
  });

  it("uses the exact durable marker and fails closed for exact or malformed dirty state", async () => {
    const paths = await makePaths();
    await new SqliteQueueProjection(paths).rebuild([]);
    let observedMarker: string | undefined;
    let rowsBeforeApply: readonly QueueRow[] | undefined;
    const projection = new SqliteQueueProjection(paths, {
      async afterDirtyMarker() {
        observedMarker = await readFile(paths.dirtyFile, "utf8");
        rowsBeforeApply = readRows(paths.databaseFile);
      },
    });

    await projection.apply({ subjectId: subject("1"), pending: pending("2", 1) });
    expect(observedMarker).toBe(DIRTY_BYTES);
    expect(rowsBeforeApply).toEqual([]);
    await expect(exists(paths.dirtyFile)).resolves.toBe(false);

    await writeFile(paths.dirtyFile, DIRTY_BYTES, { mode: 0o600 });
    await expect(projection.verifyAvailable()).rejects.toMatchObject({
      code: "index_unavailable",
    });
    await writeFile(paths.dirtyFile, '{"projection":"queue"}\n', { mode: 0o600 });
    await expect(projection.verifyAvailable()).rejects.toMatchObject({
      code: "index_unavailable",
    });
  });

  it("applies idempotent upserts, replaces generations, and deletes absent pending state", async () => {
    const paths = await makePaths();
    const projection = new SqliteQueueProjection(paths);
    const subjectId = subject("1");
    const first = pending("2", 1);
    const second = pending("3", 2, { added: 2, total: 3 });
    await projection.rebuild([]);

    await projection.apply({ subjectId, pending: first });
    await projection.apply({ subjectId, pending: first });
    expect(readRows(paths.databaseFile)).toHaveLength(1);
    expect(readRows(paths.databaseFile)[0]).toMatchObject({
      subject_id: subjectId,
      job_id: first.jobId,
      generation: 1,
    });

    await projection.apply({ subjectId, pending: second });
    expect(readRows(paths.databaseFile)).toHaveLength(1);
    expect(readRows(paths.databaseFile)[0]).toMatchObject({
      subject_id: subjectId,
      job_id: second.jobId,
      generation: 2,
      material_set_hash: second.materialSetHash,
    });

    await projection.apply({ subjectId });
    expect(readRows(paths.databaseFile)).toEqual([]);
  });

  it("serializes concurrent subjects across the complete dirty-marker lifetime", async () => {
    const paths = await makePaths();
    await new SqliteQueueProjection(paths).rebuild([]);
    let markerCount = 0;
    let enterFirst: (() => void) | undefined;
    let releaseFirst: (() => void) | undefined;
    const firstEntered = new Promise<void>((resolve) => {
      enterFirst = resolve;
    });
    const firstMayContinue = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const projection = new SqliteQueueProjection(paths, {
      async afterDirtyMarker() {
        markerCount += 1;
        if (markerCount === 1) {
          enterFirst?.();
          await firstMayContinue;
        }
      },
    });

    const first = projection.apply({ subjectId: subject("1"), pending: pending("2", 1) });
    await firstEntered;
    let secondSettled = false;
    const second = projection
      .apply({ subjectId: subject("3"), pending: pending("4", 1) })
      .then(() => {
        secondSettled = true;
      });
    await delay(50);
    expect(secondSettled).toBe(false);
    releaseFirst?.();
    await Promise.all([first, second]);

    expect(readRows(paths.databaseFile).map((row) => row.subject_id)).toEqual([
      subject("1"),
      subject("3"),
    ]);
    await expect(exists(paths.dirtyFile)).resolves.toBe(false);
  });

  it("collects rebuild facts under the projection lock so a waiting apply stays newest", async () => {
    const paths = await makePaths();
    const projection = new SqliteQueueProjection(paths);
    const oldSeed = { subjectId: subject("1"), pending: pending("2", 1) };
    const newSeed = { subjectId: subject("1"), pending: pending("3", 2) };
    await projection.rebuild([oldSeed]);
    let enterCollection: (() => void) | undefined;
    let releaseCollection: (() => void) | undefined;
    const collectionEntered = new Promise<void>((resolve) => {
      enterCollection = resolve;
    });
    const collectionMayContinue = new Promise<void>((resolve) => {
      releaseCollection = resolve;
    });
    const staleSnapshot = async function* (): AsyncGenerator<QueueProjectionSeed> {
      yield oldSeed;
      enterCollection?.();
      await collectionMayContinue;
    };

    const rebuild = projection.rebuild(staleSnapshot());
    await collectionEntered;
    let applySettled = false;
    const apply = projection.apply(newSeed).then(() => {
      applySettled = true;
    });
    await delay(50);
    expect(applySettled).toBe(false);
    releaseCollection?.();
    await Promise.all([rebuild, apply]);

    expect(readRows(paths.databaseFile)).toEqual([
      expect.objectContaining({
        subject_id: newSeed.subjectId,
        job_id: newSeed.pending.jobId,
        generation: newSeed.pending.generation,
      }),
    ]);
  });

  it("leaves the projection dirty when failure is injected after SQLite commit", async () => {
    const paths = await makePaths();
    await new SqliteQueueProjection(paths).rebuild([]);
    const projection = new SqliteQueueProjection(paths, {
      afterApplyCommit() {
        throw new Error("injected after SQL commit");
      },
    });

    await expect(
      projection.apply({ subjectId: subject("1"), pending: pending("2", 1) }),
    ).rejects.toMatchObject({ code: "index_unavailable" });
    await expect(readFile(paths.dirtyFile, "utf8")).resolves.toBe(DIRTY_BYTES);
    expect(readRows(paths.databaseFile)).toHaveLength(1);
    await expect(projection.verifyAvailable()).rejects.toMatchObject({
      code: "index_unavailable",
    });
  });

  it("leaves the old projection dirty when failure is injected immediately after the marker", async () => {
    const paths = await makePaths();
    await new SqliteQueueProjection(paths).rebuild([]);
    const projection = new SqliteQueueProjection(paths, {
      afterDirtyMarker() {
        throw new Error("injected after dirty marker");
      },
    });

    await expect(
      projection.apply({ subjectId: subject("1"), pending: pending("2", 1) }),
    ).rejects.toMatchObject({ code: "index_unavailable" });
    await expect(readFile(paths.dirtyFile, "utf8")).resolves.toBe(DIRTY_BYTES);
    expect(readRows(paths.databaseFile)).toEqual([]);
  });

  it("leaves the committed projection dirty when failure is injected after database fsync", async () => {
    const paths = await makePaths();
    await new SqliteQueueProjection(paths).rebuild([]);
    const projection = new SqliteQueueProjection(paths, {
      afterApplyDatabaseSync() {
        throw new Error("injected after database fsync");
      },
    });

    await expect(
      projection.apply({ subjectId: subject("1"), pending: pending("2", 1) }),
    ).rejects.toMatchObject({ code: "index_unavailable" });
    await expect(readFile(paths.dirtyFile, "utf8")).resolves.toBe(DIRTY_BYTES);
    expect(readRows(paths.databaseFile)).toHaveLength(1);
  });

  it("restores the exact marker when clearing fails after unlink and before parent sync", async () => {
    const paths = await makePaths();
    await new SqliteQueueProjection(paths).rebuild([]);
    const projection = new SqliteQueueProjection(paths, {
      afterDirtyMarkerUnlink() {
        throw new Error("injected after marker unlink");
      },
    });

    await expect(
      projection.apply({ subjectId: subject("1"), pending: pending("2", 1) }),
    ).rejects.toMatchObject({ code: "index_unavailable" });
    await expect(readFile(paths.dirtyFile, "utf8")).resolves.toBe(DIRTY_BYTES);
    expect(readRows(paths.databaseFile)).toEqual([
      expect.objectContaining({ subject_id: subject("1"), job_id: pending("2", 1).jobId }),
    ]);
  });

  it("leaves an atomically replaced rebuild dirty when final marker clearing is interrupted", async () => {
    const paths = await makePaths();
    await new SqliteQueueProjection(paths).rebuild([
      { subjectId: subject("1"), pending: pending("2", 1) },
    ]);
    const replacement = { subjectId: subject("3"), pending: pending("4", 2) };
    const projection = new SqliteQueueProjection(paths, {
      afterRebuildReplaceSync() {
        throw new Error("injected after rebuild replacement");
      },
    });

    await expect(projection.rebuild([replacement])).rejects.toMatchObject({
      code: "index_unavailable",
    });
    await expect(readFile(paths.dirtyFile, "utf8")).resolves.toBe(DIRTY_BYTES);
    expect(readRows(paths.databaseFile)).toEqual([
      expect.objectContaining({
        subject_id: replacement.subjectId,
        job_id: replacement.pending.jobId,
      }),
    ]);
  });

  it("never turns missing, corrupt, row-invalid, or version-mismatched storage into empty", async () => {
    const missingPaths = await makePaths();
    const missing = new SqliteQueueProjection(missingPaths);
    await expect(missing.verifyAvailable()).rejects.toMatchObject({
      code: "index_unavailable",
    });
    await expect(exists(missingPaths.databaseFile)).resolves.toBe(false);

    const corruptPaths = await makePaths();
    await mkdir(corruptPaths.indexDirectory, { mode: 0o700 });
    await writeFile(corruptPaths.databaseFile, "not sqlite", { mode: 0o600 });
    const corrupt = new SqliteQueueProjection(corruptPaths);
    await expect(corrupt.verifyAvailable()).rejects.toMatchObject({ code: "index_unavailable" });
    await expect(
      corrupt.apply({ subjectId: subject("1"), pending: pending("2", 1) }),
    ).rejects.toMatchObject({ code: "index_unavailable" });
    await expect(readFile(corruptPaths.dirtyFile, "utf8")).resolves.toBe(DIRTY_BYTES);

    const versionPaths = await makePaths();
    const projection = new SqliteQueueProjection(versionPaths);
    await projection.rebuild([{ subjectId: subject("1"), pending: pending("2", 1) }]);
    let database = new DatabaseSync(versionPaths.databaseFile);
    database.exec("PRAGMA user_version = 2");
    database.close();
    await expect(projection.verifyAvailable()).rejects.toMatchObject({
      code: "index_unavailable",
    });

    await projection.rebuild([{ subjectId: subject("1"), pending: pending("2", 1) }]);
    database = new DatabaseSync(versionPaths.databaseFile);
    database.prepare("UPDATE queue_jobs SET job_id = 'bad'").run();
    database.close();
    await expect(projection.verifyAvailable()).rejects.toMatchObject({
      code: "index_unavailable",
    });
  });

  it("rebuilds a lost projection from verified seeds without changing JobId", async () => {
    const paths = await makePaths();
    const seed: QueueProjectionSeed = {
      subjectId: subject("1"),
      pending: pending("2", 4, { added: 2, total: 5 }),
    };
    const projection = new SqliteQueueProjection(paths);
    await projection.rebuild([seed]);
    const originalJobId = readRows(paths.databaseFile)[0]?.job_id;

    await rm(paths.databaseFile);
    await writeFile(paths.dirtyFile, DIRTY_BYTES, { mode: 0o600 });
    await projection.rebuild([seed]);

    expect(readRows(paths.databaseFile)).toHaveLength(1);
    expect(readRows(paths.databaseFile)[0]?.job_id).toBe(originalJobId);
    expect(readRows(paths.databaseFile)[0]?.job_id).toBe(seed.pending?.jobId);
    await expect(exists(paths.dirtyFile)).resolves.toBe(false);
  });

  it("keeps the marker through DB fsync and rebuild replace-parent-sync", async () => {
    const paths = await makePaths();
    const initial = { subjectId: subject("1"), pending: pending("2", 1) };
    await new SqliteQueueProjection(paths).rebuild([initial]);
    const replacement = { subjectId: subject("3"), pending: pending("4", 2) };
    const observations: string[] = [];
    const hooks: SqliteQueueProjectionHooks = {
      async afterRebuildReplaceSync() {
        observations.push(await readFile(paths.dirtyFile, "utf8"));
        expect(readRows(paths.databaseFile)[0]?.job_id).toBe(replacement.pending.jobId);
      },
      async afterApplyDatabaseSync() {
        observations.push(await readFile(paths.dirtyFile, "utf8"));
        expect(readRows(paths.databaseFile)[0]?.generation).toBe(3);
      },
    };
    const projection = new SqliteQueueProjection(paths, hooks);

    await projection.rebuild([replacement]);
    await projection.apply({
      subjectId: replacement.subjectId,
      pending: pending("5", 3, { added: 3, total: 4 }),
    });

    expect(observations).toEqual([DIRTY_BYTES, DIRTY_BYTES]);
    await expect(exists(paths.dirtyFile)).resolves.toBe(false);
  });

  it.runIf(process.platform !== "win32")(
    "rejects a symlink database target and leaves the exact dirty marker",
    async () => {
      const paths = await makePaths();
      const outsideRoot = await mkdtemp(join(tmpdir(), "distilly-queue-outside-"));
      roots.push(outsideRoot);
      const outside = join(outsideRoot, "outside.db");
      await mkdir(paths.indexDirectory, { mode: 0o700 });
      await writeFile(outside, "outside", { mode: 0o600 });
      await symlink(outside, paths.databaseFile);

      await expect(
        new SqliteQueueProjection(paths).rebuild([
          { subjectId: subject("1"), pending: pending("2", 1) },
        ]),
      ).rejects.toMatchObject({ code: "index_unavailable" });

      await expect(readFile(outside, "utf8")).resolves.toBe("outside");
      await expect(readFile(paths.dirtyFile, "utf8")).resolves.toBe(DIRTY_BYTES);
      expect((await readdir(paths.indexDirectory)).some((name) => name.endsWith(".rebuild"))).toBe(
        false,
      );
    },
  );
});
