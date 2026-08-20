import { randomBytes } from "node:crypto";
import { constants, lstatSync, type Stats } from "node:fs";
import { lstat, open, rename, rm, unlink } from "node:fs/promises";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";

import {
  pendingJobMarkerSchema,
  subjectIdSchema,
  type PendingJobMarker,
  type SubjectId,
} from "@distilly/protocol";

import { atomicReplaceFile, ensurePrivateDirectory, syncDirectory } from "../facts/atomic-write.js";
import { assertNoSymlinkPath, isMissing, readRegularFile } from "../facts/safe-fs.js";
import { indexUnavailable, storageCorrupt } from "../internal-errors.js";
import { FileLock } from "../transaction/file-lock.js";
import type { FileLockLease } from "../transaction/file-lock.js";

const QUEUE_SCHEMA_VERSION = 1;
const QUEUE_DIRTY_BYTES = '{"projection":"queue","schemaVersion":1}\n';
const MARKER_MAXIMUM_BYTES = 1_024;
const QUEUE_TABLE = "queue_jobs";
const QUEUE_LOCK_DIRECTORY = "queue.projection.lock";
const QUEUE_LOCK_RETRY_MS = 10;

const CREATE_QUEUE_TABLE_SQL = `CREATE TABLE ${QUEUE_TABLE} (
  subject_id TEXT PRIMARY KEY NOT NULL,
  job_id TEXT NOT NULL UNIQUE,
  generation INTEGER NOT NULL CHECK (generation >= 0),
  base_version_id TEXT,
  material_set_hash TEXT NOT NULL,
  added_material_count INTEGER NOT NULL CHECK (added_material_count >= 0),
  total_material_count INTEGER NOT NULL CHECK (total_material_count >= 0),
  queued_at TEXT NOT NULL,
  CHECK (added_material_count <= total_material_count)
) STRICT`;

const UPSERT_PENDING_SQL = `INSERT INTO ${QUEUE_TABLE} (
  subject_id,
  job_id,
  generation,
  base_version_id,
  material_set_hash,
  added_material_count,
  total_material_count,
  queued_at
) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(subject_id) DO UPDATE SET
  job_id = excluded.job_id,
  generation = excluded.generation,
  base_version_id = excluded.base_version_id,
  material_set_hash = excluded.material_set_hash,
  added_material_count = excluded.added_material_count,
  total_material_count = excluded.total_material_count,
  queued_at = excluded.queued_at`;

interface QueueRow {
  readonly subject_id: unknown;
  readonly job_id: unknown;
  readonly generation: unknown;
  readonly base_version_id: unknown;
  readonly material_set_hash: unknown;
  readonly added_material_count: unknown;
  readonly total_material_count: unknown;
  readonly queued_at: unknown;
}

/** Explicit filesystem locations owned by the internal queue projection. */
export interface SqliteQueueProjectionPaths {
  readonly root: string;
  readonly indexDirectory: string;
  readonly databaseFile: string;
  readonly dirtyFile: string;
}

/** One fact-verified subject state used to apply or rebuild the queue projection. */
export interface QueueProjectionSeed {
  readonly subjectId: SubjectId;
  readonly pending?: PendingJobMarker;
}

/** Fault-injection hooks for durability-order tests. */
export interface SqliteQueueProjectionHooks {
  /** Runs after the exact dirty marker is durable and before SQLite changes begin. */
  readonly afterDirtyMarker?: () => void | Promise<void>;
  /** Runs after an apply transaction commits and closes, before the DB file is synchronized. */
  readonly afterApplyCommit?: () => void | Promise<void>;
  /** Runs after an apply DB file is synchronized, while the dirty marker still exists. */
  readonly afterApplyDatabaseSync?: () => void | Promise<void>;
  /** Runs after a rebuilt DB replacement and parent sync, while the dirty marker still exists. */
  readonly afterRebuildReplaceSync?: () => void | Promise<void>;
  /** Runs after dirty-marker unlink and before its parent directory is synchronized. */
  readonly afterDirtyMarkerUnlink?: () => void | Promise<void>;
}

const hasCode = (error: unknown, code: string): boolean =>
  typeof error === "object" && error !== null && "code" in error && error.code === code;

const isWithin = (root: string, path: string): boolean => {
  const fromRoot = relative(root, path);
  return (
    fromRoot !== "" &&
    fromRoot !== ".." &&
    !fromRoot.startsWith(`..${sep}`) &&
    !fromRoot.startsWith(sep)
  );
};

const parseSeed = (seed: QueueProjectionSeed): QueueProjectionSeed => {
  try {
    const subjectId = subjectIdSchema.parse(seed.subjectId);
    if (seed.pending === undefined) return { subjectId };
    const parsed = pendingJobMarkerSchema.parse(seed.pending);
    const pending: PendingJobMarker = {
      jobId: parsed.jobId,
      generation: parsed.generation,
      ...(parsed.baseVersionId === undefined ? {} : { baseVersionId: parsed.baseVersionId }),
      materialSetHash: parsed.materialSetHash,
      addedMaterialCount: parsed.addedMaterialCount,
      totalMaterialCount: parsed.totalMaterialCount,
      queuedAt: parsed.queuedAt,
    };
    return { subjectId, pending };
  } catch (error) {
    throw storageCorrupt("Verified queue projection seed is invalid.", error);
  }
};

const readInteger = (row: Record<string, unknown> | undefined, key: string): number => {
  const value = row?.[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw indexUnavailable("Queue projection metadata is invalid.");
  }
  return value;
};

const configureDatabase = (database: DatabaseSync): void => {
  database.exec("PRAGMA journal_mode = DELETE");
  database.exec("PRAGMA synchronous = FULL");
  database.exec("PRAGMA foreign_keys = ON");
  database.exec("PRAGMA busy_timeout = 5000");
};

const createSchema = (database: DatabaseSync): void => {
  configureDatabase(database);
  database.exec(CREATE_QUEUE_TABLE_SQL);
  database.exec(`PRAGMA user_version = ${QUEUE_SCHEMA_VERSION}`);
};

const readQueueRows = (database: DatabaseSync): readonly QueueRow[] =>
  database
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
      FROM ${QUEUE_TABLE}
      ORDER BY subject_id`,
    )
    .all() as unknown as readonly QueueRow[];

const verifyRows = (database: DatabaseSync): void => {
  for (const row of readQueueRows(database)) {
    try {
      const subjectId = subjectIdSchema.parse(row.subject_id);
      const pending = pendingJobMarkerSchema.parse({
        jobId: row.job_id,
        generation: row.generation,
        ...(row.base_version_id === null ? {} : { baseVersionId: row.base_version_id }),
        materialSetHash: row.material_set_hash,
        addedMaterialCount: row.added_material_count,
        totalMaterialCount: row.total_material_count,
        queuedAt: row.queued_at,
      });
      void subjectId;
      void pending;
    } catch (error) {
      throw indexUnavailable("Queue projection contains an invalid row.", error);
    }
  }
};

const verifyDatabase = (database: DatabaseSync): void => {
  const version = readInteger(database.prepare("PRAGMA user_version").get(), "user_version");
  if (version !== QUEUE_SCHEMA_VERSION) {
    throw indexUnavailable("Queue projection schema version is unavailable.");
  }

  const table = database
    .prepare("SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = ?")
    .get(QUEUE_TABLE);
  if (table?.sql !== CREATE_QUEUE_TABLE_SQL) {
    throw indexUnavailable("Queue projection table schema is unavailable.");
  }

  const integrity = database.prepare("PRAGMA quick_check(1)").get();
  if (integrity?.quick_check !== "ok") {
    throw indexUnavailable("Queue projection failed its integrity check.");
  }
  verifyRows(database);
};

const insertPending = (
  database: DatabaseSync,
  subjectId: SubjectId,
  pending: PendingJobMarker,
): void => {
  database
    .prepare(UPSERT_PENDING_SQL)
    .run(
      subjectId,
      pending.jobId,
      pending.generation,
      pending.baseVersionId ?? null,
      pending.materialSetHash,
      pending.addedMaterialCount,
      pending.totalMaterialCount,
      pending.queuedAt,
    );
};

/** Durable, fact-derived SQLite projection of current pending-job markers. */
export class SqliteQueueProjection {
  private readonly root: string;
  private readonly indexDirectory: string;
  private readonly databaseFile: string;
  private readonly dirtyFile: string;
  private readonly lock: FileLock;
  private readonly hooks: SqliteQueueProjectionHooks;

  /**
   * Creates the package-internal queue projection.
   *
   * @param paths - Explicit confined projection paths.
   * @param hooks - Optional durability fault-injection hooks.
   */
  constructor(paths: SqliteQueueProjectionPaths, hooks: SqliteQueueProjectionHooks = {}) {
    this.root = resolve(paths.root);
    this.indexDirectory = resolve(paths.indexDirectory);
    this.databaseFile = resolve(paths.databaseFile);
    this.dirtyFile = resolve(paths.dirtyFile);
    this.hooks = hooks;

    if (
      !isWithin(this.root, this.indexDirectory) ||
      dirname(this.databaseFile) !== this.indexDirectory ||
      dirname(this.dirtyFile) !== this.indexDirectory ||
      this.databaseFile === this.dirtyFile
    ) {
      throw storageCorrupt("Queue projection paths escape their private index directory.");
    }
    const lockDirectory = join(this.indexDirectory, QUEUE_LOCK_DIRECTORY);
    const collidesWithLock = (path: string): boolean => {
      const name = basename(path);
      return (
        path === lockDirectory ||
        name.startsWith(`${QUEUE_LOCK_DIRECTORY}.`) ||
        name.startsWith(`.${QUEUE_LOCK_DIRECTORY}.`)
      );
    };
    if (collidesWithLock(this.databaseFile) || collidesWithLock(this.dirtyFile)) {
      throw storageCorrupt("Queue projection paths collide with its internal lock.");
    }
    this.lock = new FileLock(this.root, lockDirectory);
  }

  /**
   * Applies the authoritative pending marker for one subject.
   *
   * @param seed - Verified subject id and its current pending marker, if any.
   * @returns A promise resolved only after the projection is durable and clean.
   */
  async apply(seed: QueueProjectionSeed): Promise<void> {
    const verifiedSeed = parseSeed(seed);
    await this.withLock(async () => {
      await this.prepareIndexDirectory();
      await this.assertMarkerAbsent();
      try {
        this.openVerifiedDatabase(true).close();
      } catch (error) {
        await this.writeDirtyMarker().catch(() => undefined);
        throw this.asUnavailable("Queue projection cannot accept an incremental update.", error);
      }

      await this.writeDirtyMarker();
      try {
        await this.hooks.afterDirtyMarker?.();

        let database: DatabaseSync | undefined;
        try {
          database = this.openVerifiedDatabase(false);
          configureDatabase(database);
          database.exec("BEGIN IMMEDIATE");
          try {
            if (verifiedSeed.pending === undefined) {
              database
                .prepare(`DELETE FROM ${QUEUE_TABLE} WHERE subject_id = ?`)
                .run(verifiedSeed.subjectId);
            } else {
              insertPending(database, verifiedSeed.subjectId, verifiedSeed.pending);
            }
            database.exec("COMMIT");
          } catch (error) {
            if (database.isTransaction) database.exec("ROLLBACK");
            throw error;
          }
        } finally {
          database?.close();
        }

        await this.hooks.afterApplyCommit?.();
        await this.syncDatabaseFile();
        await this.hooks.afterApplyDatabaseSync?.();
        await this.clearDirtyMarker();
      } catch (error) {
        throw this.asUnavailable("Queue projection apply failed.", error);
      }
    });
  }

  /**
   * Rebuilds the complete queue projection from fact-verified state seeds.
   *
   * @param seeds - Verified subject states whose pending markers are authoritative.
   * @returns A promise resolved after atomic replacement and durable marker clearing.
   */
  async rebuild(
    seeds: Iterable<QueueProjectionSeed> | AsyncIterable<QueueProjectionSeed>,
  ): Promise<void> {
    await this.withLock(async () => {
      const verifiedSeeds = await this.collectSeeds(seeds);
      await this.prepareIndexDirectory();
      await this.writeDirtyMarker();

      const temporary = join(
        this.indexDirectory,
        `.${basename(this.databaseFile)}.${process.pid}.${randomBytes(8).toString("hex")}.rebuild`,
      );
      let published = false;
      try {
        await this.hooks.afterDirtyMarker?.();
        const handle = await open(
          temporary,
          constants.O_CREAT | constants.O_EXCL | constants.O_RDWR,
          0o600,
        );
        await handle.close();

        let database: DatabaseSync | undefined;
        try {
          database = new DatabaseSync(temporary, {
            allowExtension: false,
            enableDoubleQuotedStringLiterals: false,
          });
          createSchema(database);
          database.exec("BEGIN IMMEDIATE");
          try {
            for (const seed of verifiedSeeds) {
              if (seed.pending !== undefined) {
                insertPending(database, seed.subjectId, seed.pending);
              }
            }
            database.exec("COMMIT");
          } catch (error) {
            if (database.isTransaction) database.exec("ROLLBACK");
            throw error;
          }
          verifyDatabase(database);
        } finally {
          database?.close();
        }

        await this.syncFile(temporary);
        await this.assertReplaceableDatabaseTarget();
        await rename(temporary, this.databaseFile);
        published = true;
        await syncDirectory(this.indexDirectory);
        await this.hooks.afterRebuildReplaceSync?.();
        await this.clearDirtyMarker();
      } catch (error) {
        throw this.asUnavailable("Queue projection rebuild failed.", error);
      } finally {
        if (!published) await rm(temporary, { force: true });
      }
    });
  }

  /**
   * Verifies that the internal projection is clean, readable, and schema-valid.
   *
   * @returns A promise rejected with index_unavailable instead of returning an empty view.
   */
  async verifyAvailable(): Promise<void> {
    await this.withLock(async () => {
      await this.prepareIndexDirectory();
      await this.assertMarkerAbsent();
      let database: DatabaseSync | undefined;
      try {
        database = this.openVerifiedDatabase(true);
      } catch (error) {
        throw this.asUnavailable("Queue projection is unavailable.", error);
      } finally {
        database?.close();
      }
    });
  }

  private async collectSeeds(
    seeds: Iterable<QueueProjectionSeed> | AsyncIterable<QueueProjectionSeed>,
  ): Promise<readonly QueueProjectionSeed[]> {
    const collected: QueueProjectionSeed[] = [];
    const subjects = new Set<string>();
    const jobs = new Set<string>();
    for await (const rawSeed of seeds) {
      const seed = parseSeed(rawSeed);
      if (subjects.has(seed.subjectId)) {
        throw storageCorrupt("Verified queue projection seeds contain a duplicate subject.");
      }
      subjects.add(seed.subjectId);
      if (seed.pending !== undefined) {
        if (jobs.has(seed.pending.jobId)) {
          throw storageCorrupt("Verified queue projection seeds contain a duplicate job id.");
        }
        jobs.add(seed.pending.jobId);
      }
      collected.push(seed);
    }
    return collected.sort((left, right) => left.subjectId.localeCompare(right.subjectId));
  }

  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    const lease = await this.acquireLock();
    try {
      const result = await operation();
      await lease.release();
      return result;
    } catch (error) {
      await lease.release().catch(() => undefined);
      throw error;
    }
  }

  private async acquireLock(): Promise<FileLockLease> {
    while (true) {
      try {
        return await this.lock.acquire();
      } catch (error) {
        if (!hasCode(error, "busy")) throw error;
        await delay(QUEUE_LOCK_RETRY_MS);
      }
    }
  }

  private async prepareIndexDirectory(): Promise<void> {
    await assertNoSymlinkPath(this.root, this.indexDirectory);
    await ensurePrivateDirectory(this.indexDirectory);
    await assertNoSymlinkPath(this.root, this.indexDirectory);
  }

  private async assertMarkerAbsent(): Promise<void> {
    let status;
    try {
      status = await lstat(this.dirtyFile);
    } catch (error) {
      if (isMissing(error)) return;
      throw this.asUnavailable("Queue projection dirty marker cannot be inspected.", error);
    }
    if (status.isSymbolicLink() || !status.isFile()) {
      throw indexUnavailable("Queue projection dirty marker is not a regular file.");
    }
    let data: Buffer;
    try {
      data = await readRegularFile(this.root, this.dirtyFile, MARKER_MAXIMUM_BYTES);
    } catch (error) {
      throw this.asUnavailable("Queue projection dirty marker cannot be read.", error);
    }
    const exact = data.equals(Buffer.from(QUEUE_DIRTY_BYTES));
    throw indexUnavailable(
      exact ? "Queue projection is marked dirty." : "Queue projection dirty marker is malformed.",
    );
  }

  private async writeDirtyMarker(): Promise<void> {
    try {
      await atomicReplaceFile(this.root, this.dirtyFile, QUEUE_DIRTY_BYTES);
    } catch (error) {
      throw this.asUnavailable("Queue projection dirty marker could not be made durable.", error);
    }
  }

  private async clearDirtyMarker(): Promise<void> {
    let data: Buffer;
    try {
      data = await readRegularFile(this.root, this.dirtyFile, MARKER_MAXIMUM_BYTES);
    } catch (error) {
      throw this.asUnavailable("Queue projection dirty marker disappeared before clearing.", error);
    }
    if (!data.equals(Buffer.from(QUEUE_DIRTY_BYTES))) {
      throw indexUnavailable("Queue projection dirty marker changed before clearing.");
    }
    let unlinked = false;
    try {
      await unlink(this.dirtyFile);
      unlinked = true;
      await this.hooks.afterDirtyMarkerUnlink?.();
      await syncDirectory(this.indexDirectory);
    } catch (error) {
      if (unlinked) {
        await atomicReplaceFile(this.root, this.dirtyFile, QUEUE_DIRTY_BYTES).catch(
          () => undefined,
        );
      }
      throw this.asUnavailable(
        "Queue projection dirty marker could not be cleared durably.",
        error,
      );
    }
  }

  private openVerifiedDatabase(readOnly: boolean): DatabaseSync {
    try {
      requireRegularFile(this.databaseFile);
    } catch (error) {
      throw this.asUnavailable("Queue projection database is missing or unsafe.", error);
    }

    let database: DatabaseSync | undefined;
    try {
      database = new DatabaseSync(this.databaseFile, {
        allowExtension: false,
        enableDoubleQuotedStringLiterals: false,
        readOnly,
      });
      verifyDatabase(database);
      return database;
    } catch (error) {
      database?.close();
      throw this.asUnavailable("Queue projection database is corrupt or incompatible.", error);
    }
  }

  private async assertReplaceableDatabaseTarget(): Promise<void> {
    await assertNoSymlinkPath(this.root, this.indexDirectory);
    try {
      const status = await lstat(this.databaseFile);
      if (status.isSymbolicLink() || !status.isFile()) {
        throw storageCorrupt("Queue projection database target is not a regular file.");
      }
    } catch (error) {
      if (!isMissing(error)) throw error;
    }
  }

  private syncDatabaseFile(): Promise<void> {
    return this.syncFile(this.databaseFile);
  }

  private async syncFile(path: string): Promise<void> {
    let handle;
    try {
      handle = await open(path, constants.O_RDONLY);
      await handle.sync();
    } catch (error) {
      throw this.asUnavailable("Queue projection database could not be synchronized.", error);
    } finally {
      await handle?.close();
    }
  }

  private asUnavailable(message: string, error: unknown): Error {
    if (error instanceof Error && hasCode(error, "index_unavailable")) return error;
    return indexUnavailable(message, error);
  }
}

const requireRegularFile = (path: string): Stats => {
  try {
    const status = lstatSync(path);
    if (status.isSymbolicLink() || !status.isFile()) {
      throw storageCorrupt("Queue projection database is not a regular file.");
    }
    return status;
  } catch (error) {
    if (hasCode(error, "ENOENT")) throw indexUnavailable("Queue projection database is missing.");
    throw error;
  }
};
