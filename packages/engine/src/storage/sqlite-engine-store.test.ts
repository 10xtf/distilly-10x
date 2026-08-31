import { chmod, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Worker } from "node:worker_threads";

import { DistillyError } from "@distilly/protocol";
import { afterEach, describe, expect, it } from "vitest";

import { SqliteEngineStore } from "./sqlite-engine-store.js";
import { mapStorageError } from "./storage-errors.js";

const roots: string[] = [];

const temporaryRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-sqlite-"));
  roots.push(root);
  return root;
};

const scalar = (database: DatabaseSync, sql: string): unknown => {
  const row = database.prepare(sql).get() as Record<string, unknown> | undefined;
  return row === undefined ? undefined : Object.values(row)[0];
};

const insertSpace = (database: DatabaseSync, id: string, label = "People"): void => {
  database
    .prepare(
      `INSERT INTO spaces(id, display_name, canonical_label, kind)
       VALUES (?, ?, ?, 'people')`,
    )
    .run(id, label, label);
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("SqliteEngineStore", () => {
  it("creates the exact ten-table v1 authority in WAL/FK/FULL mode and reopens it", async () => {
    const root = await temporaryRoot();
    let store = await SqliteEngineStore.open(root);
    store.write((database) => insertSpace(database, "space_test_people"));
    store.close();

    const rootMode = (await stat(root)).mode & 0o777;
    const databaseMode = (await stat(join(root, "store.sqlite3"))).mode & 0o777;
    if (process.platform !== "win32") {
      expect(rootMode).toBe(0o700);
      expect(databaseMode).toBe(0o600);
    }

    store = await SqliteEngineStore.open(root);
    const snapshot = store.read((database) => ({
      version: scalar(database, "PRAGMA user_version"),
      journal: scalar(database, "PRAGMA journal_mode"),
      synchronous: scalar(database, "PRAGMA synchronous"),
      foreignKeys: scalar(database, "PRAGMA foreign_keys"),
      tables: database
        .prepare(
          `SELECT name FROM sqlite_schema
           WHERE type = 'table' AND name NOT GLOB 'sqlite_*'
           ORDER BY name`,
        )
        .all()
        .map((row) => row.name),
      labels: database.prepare("SELECT display_name FROM spaces ORDER BY id").all(),
    }));
    expect(snapshot).toEqual({
      version: 1,
      journal: "wal",
      synchronous: 2,
      foreignKeys: 1,
      tables: [
        "blobs",
        "events",
        "materials",
        "operations",
        "pending_jobs",
        "spaces",
        "subject_aliases",
        "subject_identity_hints",
        "subject_states",
        "subjects",
      ],
      labels: [{ display_name: "People" }],
    });
    store.close();
  });

  it("allows concurrent first opens to converge on one canonical schema", async () => {
    const root = await temporaryRoot();
    const stores = await Promise.all(
      Array.from({ length: 8 }, () =>
        SqliteEngineStore.open(root, {
          busyTimeoutMs: 5_000,
        }),
      ),
    );
    try {
      for (const store of stores) {
        expect(
          store.read((database) => ({
            version: scalar(database, "PRAGMA user_version"),
            integrity: scalar(database, "PRAGMA quick_check(1)"),
          })),
        ).toEqual({ version: 1, integrity: "ok" });
      }
    } finally {
      for (const store of stores) store.close();
    }
  });

  it("commits atomically and poisons a connection whose callback returns a thenable", async () => {
    const root = await temporaryRoot();
    const store = await SqliteEngineStore.open(root);
    const marker = new Error("stop before commit");

    expect(() =>
      store.write((database) => {
        insertSpace(database, "space_rolled_back");
        throw marker;
      }),
    ).toThrow(marker);
    expect(store.read((database) => scalar(database, "SELECT count(*) FROM spaces"))).toBe(0);

    let continueCallback: (() => void) | undefined;
    const callbackGate = new Promise<void>((resolve) => {
      continueCallback = resolve;
    });
    let continuationError: unknown;
    let finishCallback: (() => void) | undefined;
    const callbackFinished = new Promise<void>((resolve) => {
      finishCallback = resolve;
    });
    expect(() =>
      store.write(async (database) => {
        insertSpace(database, "space_async");
        await callbackGate;
        try {
          insertSpace(database, "space_late_write");
        } catch (error) {
          continuationError = error;
        } finally {
          finishCallback?.();
        }
      }),
    ).toThrow("SQLite transaction callbacks must be synchronous");
    expect(() => store.read(() => undefined)).toThrow("SqliteEngineStore is closed");
    continueCallback?.();
    await callbackFinished;
    expect(continuationError).toBeInstanceOf(Error);

    const reopened = await SqliteEngineStore.open(root);
    expect(reopened.read((database) => scalar(database, "SELECT count(*) FROM spaces"))).toBe(0);
    reopened.close();
  });

  it("enforces foreign keys, duplicate-name tolerance, locator uniqueness, and state/job checks", async () => {
    const root = await temporaryRoot();
    const store = await SqliteEngineStore.open(root);
    store.write((database) => {
      insertSpace(database, "space_people");
      const insertSubject = database.prepare(
        `INSERT INTO subjects(id, space_id, display_name, canonical_label, lifecycle)
         VALUES (?, 'space_people', 'Ada', 'Ada', 'active')`,
      );
      insertSubject.run("subject_one");
      insertSubject.run("subject_two");
      database
        .prepare(
          `INSERT INTO subject_states(
             subject_id, generation, material_set_hash, current_version_id, suspended_version_id
           ) VALUES (?, 0, NULL, NULL, NULL)`,
        )
        .run("subject_one");
      database
        .prepare(
          `INSERT INTO subject_identity_hints(
             subject_id, hint_key, kind, provider, value, locator_key
           ) VALUES (?, ?, 'url', NULL, ?, ?)`,
        )
        .run(
          "subject_one",
          "url:https://example.test/ada",
          "https://example.test/ada",
          "url:https://example.test/ada",
        );
    });

    expect(() =>
      store.write((database) =>
        database
          .prepare(
            `INSERT INTO subject_identity_hints(
               subject_id, hint_key, kind, provider, value, locator_key
             ) VALUES (?, ?, 'url', NULL, ?, ?)`,
          )
          .run(
            "subject_two",
            "same-locator",
            "https://example.test/ada",
            "url:https://example.test/ada",
          ),
      ),
    ).toThrowError(expect.objectContaining({ code: "storage_corrupt" }));
    expect(() =>
      store.write((database) =>
        database
          .prepare(
            `INSERT INTO subjects(id, space_id, display_name, canonical_label, lifecycle)
             VALUES ('subject_orphan', 'space_missing', 'Orphan', 'Orphan', 'active')`,
          )
          .run(),
      ),
    ).toThrow();
    expect(() =>
      store.write((database) =>
        database
          .prepare(
            "UPDATE subject_states SET current_version_id = ? WHERE subject_id = 'subject_one'",
          )
          .run(`version_${"a".repeat(64)}`),
      ),
    ).toThrowError(expect.objectContaining({ code: "storage_corrupt" }));
    expect(() =>
      store.write((database) =>
        database
          .prepare(
            `INSERT INTO subject_states(
               subject_id, generation, material_set_hash, current_version_id, suspended_version_id
             ) VALUES ('subject_two', 1, NULL, NULL, NULL)`,
          )
          .run(),
      ),
    ).toThrow();
    expect(() =>
      store.write((database) =>
        database
          .prepare(
            `INSERT INTO pending_jobs(
               subject_id, job_id, generation, base_version_id, material_set_hash,
               added_material_count, total_material_count, queued_at
             ) VALUES ('subject_two', 'job_bad', 1, NULL, 'set_bad', 0, 1, '2026-08-30T00:00:00.000Z')`,
          )
          .run(),
      ),
    ).toThrow();
    expect(() =>
      store.write((database) =>
        database
          .prepare("INSERT INTO blobs(digest, byte_length) VALUES ('sha256_too_large', ?)")
          .run(9_007_199_254_740_992n),
      ),
    ).toThrowError(expect.objectContaining({ code: "storage_corrupt" }));
    store.close();
  });

  it("maps BEGIN IMMEDIATE contention to a retryable busy error", async () => {
    const root = await temporaryRoot();
    const store = await SqliteEngineStore.open(root, { busyTimeoutMs: 0 });
    const blocker = new DatabaseSync(join(root, "store.sqlite3"));
    blocker.exec("PRAGMA busy_timeout = 0");
    blocker.exec("BEGIN IMMEDIATE");
    try {
      expect(() => store.write(() => undefined)).toThrowError(
        expect.objectContaining({ code: "busy", retryable: true }),
      );
    } finally {
      blocker.exec("ROLLBACK");
      blocker.close();
      store.close();
    }
  });

  it("applies its busy timeout while preflighting an existing schema", async () => {
    const root = await temporaryRoot();
    const databaseFile = join(root, "store.sqlite3");
    await SqliteEngineStore.open(root).then((store) => store.close());
    const journal = new DatabaseSync(databaseFile);
    journal.exec("PRAGMA journal_mode = DELETE");
    journal.close();

    const worker = new Worker(
      `
        const { parentPort, workerData } = require("node:worker_threads");
        const { DatabaseSync } = require("node:sqlite");
        const database = new DatabaseSync(workerData.databaseFile);
        database.exec("PRAGMA journal_mode = DELETE; BEGIN EXCLUSIVE");
        parentPort.postMessage("locked");
        setTimeout(() => {
          database.exec("ROLLBACK");
          database.close();
          parentPort.postMessage("released");
        }, workerData.holdMilliseconds);
      `,
      {
        eval: true,
        workerData: { databaseFile, holdMilliseconds: 300 },
      },
    );
    const locked = new Promise<void>((resolve, reject) => {
      worker.once("message", (message) => {
        if (message === "locked") resolve();
        else reject(new Error(`Unexpected worker message: ${String(message)}`));
      });
      worker.once("error", reject);
    });
    const exited = new Promise<number>((resolve, reject) => {
      worker.once("exit", resolve);
      worker.once("error", reject);
    });
    await locked;

    const startedAt = Date.now();
    const store = await SqliteEngineStore.open(root, { busyTimeoutMs: 5_000 });
    const elapsed = Date.now() - startedAt;
    try {
      expect(elapsed).toBeGreaterThanOrEqual(200);
      expect(store.read((database) => scalar(database, "PRAGMA user_version"))).toBe(1);
      expect(await exited).toBe(0);
    } finally {
      store.close();
      await worker.terminate();
    }
  });

  it("fails closed for a symlink root, physical corruption, shape drift, and unknown versions", async () => {
    const parent = await temporaryRoot();
    const target = join(parent, "target");
    const linked = join(parent, "linked");
    await SqliteEngineStore.open(target).then((store) => store.close());
    await symlink(target, linked, "dir");
    await expect(SqliteEngineStore.open(linked)).rejects.toMatchObject({ code: "storage_corrupt" });

    const corruptRoot = await temporaryRoot();
    await writeFile(join(corruptRoot, "store.sqlite3"), "not a sqlite database", { mode: 0o600 });
    await expect(SqliteEngineStore.open(corruptRoot)).rejects.toMatchObject({
      code: "storage_corrupt",
    });

    const driftRoot = await temporaryRoot();
    await SqliteEngineStore.open(driftRoot).then((store) => store.close());
    let raw = new DatabaseSync(join(driftRoot, "store.sqlite3"));
    raw.exec("DROP INDEX subject_name_lookup");
    raw.close();
    await expect(SqliteEngineStore.open(driftRoot)).rejects.toMatchObject({
      code: "storage_corrupt",
    });

    const versionRoot = await temporaryRoot();
    raw = new DatabaseSync(join(versionRoot, "store.sqlite3"));
    expect(scalar(raw, "PRAGMA journal_mode")).toBe("delete");
    raw.exec("PRAGMA user_version = 2");
    raw.close();
    await expect(SqliteEngineStore.open(versionRoot)).rejects.toMatchObject({
      code: "schema_unsupported",
    });
    raw = new DatabaseSync(join(versionRoot, "store.sqlite3"));
    expect(scalar(raw, "PRAGMA user_version")).toBe(2);
    expect(scalar(raw, "PRAGMA journal_mode")).toBe("delete");
    raw.close();

    const malformedV1Root = await temporaryRoot();
    const malformedV1Path = join(malformedV1Root, "store.sqlite3");
    raw = new DatabaseSync(malformedV1Path);
    raw.exec("CREATE TABLE unrelated(secret TEXT); PRAGMA user_version = 1");
    expect(scalar(raw, "PRAGMA journal_mode")).toBe("delete");
    raw.close();
    if (process.platform !== "win32") await chmod(malformedV1Path, 0o644);
    const beforeBytes = await readFile(malformedV1Path);
    const beforeMode = (await stat(malformedV1Path)).mode & 0o777;
    await expect(SqliteEngineStore.open(malformedV1Root)).rejects.toMatchObject({
      code: "storage_corrupt",
    });
    expect(await readFile(malformedV1Path)).toEqual(beforeBytes);
    expect((await stat(malformedV1Path)).mode & 0o777).toBe(beforeMode);
    expect(await readdir(malformedV1Root)).toEqual(["store.sqlite3"]);
    raw = new DatabaseSync(malformedV1Path);
    expect(scalar(raw, "PRAGMA journal_mode")).toBe("delete");
    expect(scalar(raw, "SELECT count(*) FROM unrelated")).toBe(0);
    raw.close();
  });

  it("normalizes filesystem permission failures without leaking paths", async () => {
    const cause = Object.assign(new Error("private path"), { code: "EACCES" });
    const mapped = mapStorageError(cause, "open its local database");
    expect(mapped).toBeInstanceOf(DistillyError);
    expect(mapped).toMatchObject({ code: "permission_denied", retryable: false });
    expect((mapped as Error).message).not.toContain("private path");
    const constraint = mapStorageError(
      Object.assign(new Error("UNIQUE constraint failed: private_table.secret"), {
        code: "ERR_SQLITE_ERROR",
        errcode: 2067,
      }),
      "write its local database",
    );
    expect(constraint).toMatchObject({ code: "storage_corrupt" });
    expect((constraint as Error).message).not.toContain("private_table");

    const root = await temporaryRoot();
    const store = await SqliteEngineStore.open(root);
    store.close();
    if (process.platform !== "win32") {
      await chmod(root, 0o755);
      await SqliteEngineStore.open(root).then((next) => next.close());
      expect((await stat(root)).mode & 0o777).toBe(0o700);
      expect(await readFile(join(root, "store.sqlite3"))).toBeInstanceOf(Buffer);
    }
  });
});
