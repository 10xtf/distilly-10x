import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const rootModule = await import("@distilly/engine");
assert.deepEqual(Object.keys(rootModule), [], "the Engine root export must remain empty");

const { PromptCatalog } = await import("../lib/distill/prompt-catalog.js");
const promptContract = await new PromptCatalog().load();
assert.equal(
  promptContract.promptVersion,
  "host-distill-v1-sha256_667e3c0cc6cc55a1ba32f0476c17af5540659267d4b66a31c4c258adc259db1e",
  "the built package must load the exact packed host-distill prompt",
);

const { createInternalEngineComposition } = await import("../lib/ingest/composition.js");

const actor = { kind: "sdk", id: "sqlite-crash-child" };
const input = {
  subject: {
    kind: "create",
    input: {
      displayName: "Ada Lovelace",
      aliases: ["Ada"],
      identityHints: [{ kind: "url", value: "https://example.com/ada" }],
    },
  },
  materials: [
    {
      clientRef: "sqlite-crash-source",
      kind: "web",
      content: "Verified SQLite crash evidence.",
      source: {
        uri: "https://example.com/sqlite-crash",
        medium: "article",
        access: "public",
        role: "reference",
        capturedAt: "2026-08-30T00:00:00.000Z",
      },
      derivation: { kind: "native_text" },
    },
  ],
  enqueue: "now",
};

const requestIdFor = (digit) => `req_${digit.toString(16).padStart(32, "0")}`;

const blobPath = (root, content) => {
  const digest = `sha256_${createHash("sha256").update(content).digest("hex")}`;
  return join(
    root,
    "blobs",
    "sha256",
    digest.slice("sha256_".length, "sha256_".length + 2),
    digest,
  );
};

const inspect = (root) => {
  const database = new DatabaseSync(join(root, "store.sqlite3"), { readOnly: true });
  try {
    const count = (table) => database.prepare(`SELECT count(*) AS count FROM ${table}`).get().count;
    return {
      spaces: count("spaces"),
      subjects: count("subjects"),
      aliases: count("subject_aliases"),
      identityHints: count("subject_identity_hints"),
      subjectStates: count("subject_states"),
      blobRows: count("blobs"),
      materials: count("materials"),
      pending: count("pending_jobs"),
      operations: count("operations"),
      events: count("events"),
      journalMode: database.prepare("PRAGMA journal_mode").get().journal_mode,
      quickCheck: database.prepare("PRAGMA quick_check(1)").get().quick_check,
      foreignKeyFailures: database.prepare("PRAGMA foreign_key_check").all(),
    };
  } finally {
    database.close();
  }
};

const waitForOutput = async (state, expected) => {
  const deadline = Date.now() + 5_000;
  while (!state.stdout.includes(expected)) {
    if (state.child.exitCode !== null || Date.now() >= deadline) {
      throw new Error(
        `child did not print ${JSON.stringify(expected)}; stdout=${JSON.stringify(state.stdout)} stderr=${JSON.stringify(state.stderr)}`,
      );
    }
    await delay(10);
  }
};

const withDeadline = (promise, milliseconds, label) =>
  new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`${label} exceeded its deadline`)),
      milliseconds,
    );
    timeout.unref();
    promise.then(
      (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    );
  });

const reapChild = async (state, label) => {
  if (state.child.exitCode === null && state.child.signalCode === null) {
    state.child.kill("SIGKILL");
  }
  return withDeadline(state.exited, 5_000, `${label} close`);
};

const startCrashChild = (root, phase, requestId) => {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./sqlite-crash-child.mjs", import.meta.url)), root, phase, requestId],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  const state = { child, stdout: "", stderr: "" };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    state.stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    state.stderr += chunk;
  });
  state.exited = new Promise((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  return state;
};

const runIngestChild = async (root, requestId) => {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./ingest-child.mjs", import.meta.url)), root, requestId],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_NO_WARNINGS: "1" },
    },
  );
  const state = { child, stdout: "", stderr: "" };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    state.stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    state.stderr += chunk;
  });
  state.exited = new Promise((resolve) => {
    child.once("close", (code, signal) => resolve({ code, signal }));
  });
  try {
    const exit = await withDeadline(state.exited, 15_000, "ingest child");
    assert.deepEqual(exit, { code: 0, signal: null }, `ingest child failed: ${state.stderr}`);
    assert.equal(state.stderr, "", "ingest child must not emit stderr");
    const line = state.stdout
      .trim()
      .split("\n")
      .find((candidate) => candidate.startsWith("result:"));
    assert.ok(line, `ingest child did not emit a result: ${state.stdout}`);
    return JSON.parse(line.slice("result:".length));
  } finally {
    await reapChild(state, "ingest child");
  }
};

const killAt = async (root, phase, requestId) => {
  const state = startCrashChild(root, phase, requestId);
  try {
    await waitForOutput(state, `phase:${phase}`);
    assert.equal(state.child.kill("SIGKILL"), true, `the ${phase} child must accept SIGKILL`);
    const exit = await withDeadline(state.exited, 5_000, `${phase} child`);
    if (process.platform !== "win32") {
      assert.equal(exit.signal, "SIGKILL", `the ${phase} child must die from real SIGKILL`);
    }
    assert.equal(exit.code, null, `the ${phase} child must not exit normally`);
  } finally {
    await reapChild(state, `${phase} child`);
  }
};

const roots = [];
try {
  const normalRoot = await mkdtemp(join(tmpdir(), "distilly-engine-built-sqlite-"));
  roots.push(normalRoot);
  const first = await createInternalEngineComposition({ root: normalRoot });
  const normalRequest = requestIdFor(1);
  const normalResult = await first.ingest.ingest(input, actor, { requestId: normalRequest });
  assert.equal(normalResult.kind, "ingested");
  assert.equal(normalResult.created, true);
  first.close();
  const reopened = await createInternalEngineComposition({ root: normalRoot });
  assert.deepEqual(
    await reopened.ingest.ingest(input, actor, { requestId: normalRequest }),
    normalResult,
    "reopen must replay the exact stored result",
  );
  reopened.close();
  assert.deepEqual(inspect(normalRoot), {
    spaces: 1,
    subjects: 1,
    aliases: 1,
    identityHints: 1,
    subjectStates: 1,
    blobRows: 1,
    materials: 1,
    pending: 1,
    operations: 1,
    events: 3,
    journalMode: "wal",
    quickCheck: "ok",
    foreignKeyFailures: [],
  });

  const concurrentRoot = await mkdtemp(join(tmpdir(), "distilly-engine-built-concurrent-"));
  roots.push(concurrentRoot);
  const concurrent = await Promise.all([
    runIngestChild(concurrentRoot, requestIdFor(5)),
    runIngestChild(concurrentRoot, requestIdFor(6)),
  ]);
  assert.deepEqual(
    concurrent.map((result) => result.kind).sort(),
    ["already_exists", "success"],
    "two process create/ingest must publish one identity and reject the competing request",
  );
  assert.deepEqual(inspect(concurrentRoot), {
    spaces: 1,
    subjects: 1,
    aliases: 1,
    identityHints: 1,
    subjectStates: 1,
    blobRows: 1,
    materials: 1,
    pending: 1,
    operations: 1,
    events: 3,
    journalMode: "wal",
    quickCheck: "ok",
    foreignKeyFailures: [],
  });

  for (const [offset, phase] of ["after_blob", "before_commit"].entries()) {
    const root = await mkdtemp(join(tmpdir(), `distilly-engine-built-${phase}-`));
    roots.push(root);
    const requestId = requestIdFor(offset + 2);
    await killAt(root, phase, requestId);
    assert.deepEqual(inspect(root), {
      spaces: 0,
      subjects: 0,
      aliases: 0,
      identityHints: 0,
      subjectStates: 0,
      blobRows: 0,
      materials: 0,
      pending: 0,
      operations: 0,
      events: 0,
      journalMode: "wal",
      quickCheck: "ok",
      foreignKeyFailures: [],
    });
    const expectedContent = input.materials[0].content;
    const unreferencedBlob = blobPath(root, expectedContent);
    assert.equal(
      (await lstat(unreferencedBlob)).isFile(),
      true,
      `${phase} must leave the published blob as a regular file`,
    );
    assert.equal(
      await readFile(unreferencedBlob, "utf8"),
      expectedContent,
      `${phase} must leave exact immutable blob bytes`,
    );
    const retry = await createInternalEngineComposition({ root });
    const result = await retry.ingest.ingest(input, actor, { requestId });
    assert.equal(result.kind, "ingested", `${phase} exact retry must succeed without recovery`);
    retry.close();
  }

  const committedRoot = await mkdtemp(join(tmpdir(), "distilly-engine-built-after-commit-"));
  roots.push(committedRoot);
  const committedRequest = requestIdFor(4);
  await killAt(committedRoot, "after_commit", committedRequest);
  assert.deepEqual(inspect(committedRoot), {
    spaces: 1,
    subjects: 1,
    aliases: 1,
    identityHints: 1,
    subjectStates: 1,
    blobRows: 1,
    materials: 1,
    pending: 1,
    operations: 1,
    events: 3,
    journalMode: "wal",
    quickCheck: "ok",
    foreignKeyFailures: [],
  });
  const operationDatabase = new DatabaseSync(join(committedRoot, "store.sqlite3"), {
    readOnly: true,
  });
  const storedResult = JSON.parse(
    operationDatabase
      .prepare("SELECT result_json FROM operations WHERE request_id = ?")
      .get(committedRequest).result_json,
  );
  operationDatabase.close();
  const committedReplay = await createInternalEngineComposition({ root: committedRoot });
  assert.deepEqual(
    await committedReplay.ingest.ingest(input, actor, { requestId: committedRequest }),
    storedResult,
    "post-COMMIT SIGKILL must replay exact SubjectId, MaterialId, and JobId",
  );
  committedReplay.close();
} finally {
  await Promise.all(roots.map((root) => rm(root, { recursive: true, force: true })));
}
