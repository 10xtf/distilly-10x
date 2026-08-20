import assert from "node:assert/strict";
import { access, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const rootModule = await import("@distilly/engine");
assert.deepEqual(Object.keys(rootModule), [], "the Engine root export must remain empty");

const { PromptCatalog } = await import("../lib/distill/prompt-catalog.js");
const promptContract = await new PromptCatalog().load();
assert.equal(
  promptContract.promptVersion,
  "host-distill-v1-sha256_667e3c0cc6cc55a1ba32f0476c17af5540659267d4b66a31c4c258adc259db1e",
  "the built package must load the exact packed host-distill prompt",
);

const startChild = (root, eventFile, label, holdMilliseconds) => {
  const child = spawn(
    process.execPath,
    [
      fileURLToPath(new URL("./lock-child.mjs", import.meta.url)),
      root,
      eventFile,
      label,
      String(holdMilliseconds),
    ],
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

const startIngestChild = (root, requestId) => {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./ingest-child.mjs", import.meta.url)), root, requestId],
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

const startCommitChild = (root, payloadFile, requestId) => {
  const child = spawn(
    process.execPath,
    [fileURLToPath(new URL("./commit-child.mjs", import.meta.url)), root, payloadFile, requestId],
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

const waitForOutput = async (state, expected) => {
  const deadline = Date.now() + 3_000;
  while (!state.stdout.includes(expected)) {
    if (state.child.exitCode !== null || Date.now() >= deadline) {
      throw new Error(
        `child did not print ${JSON.stringify(expected)}; stdout=${JSON.stringify(state.stdout)} stderr=${JSON.stringify(state.stderr)}`,
      );
    }
    await delay(10);
  }
};

const withDeadline = async (promise, milliseconds, label) => {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} exceeded ${milliseconds}ms`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const root = await mkdtemp(join(tmpdir(), "distilly-engine-built-lock-"));
const eventFile = join(root, "events.log");
let first;
let second;
try {
  first = startChild(root, eventFile, "first", 350);
  await waitForOutput(first, "acquired:first");
  second = startChild(root, eventFile, "second", 25);

  await delay(100);
  assert.equal(
    second.stdout.includes("acquired:second"),
    false,
    "the second process acquired while the first still held the lock",
  );

  const [firstExit, secondExit] = await withDeadline(
    Promise.all([first.exited, second.exited]),
    15_000,
    "built lock children",
  );
  assert.deepEqual(firstExit, { code: 0, signal: null }, first.stderr);
  assert.deepEqual(secondExit, { code: 0, signal: null }, second.stderr);
  assert.deepEqual((await readFile(eventFile, "utf8")).trim().split("\n"), [
    "acquired:first",
    "releasing:first",
    "acquired:second",
    "releasing:second",
  ]);
} finally {
  const stopped = [];
  if (first?.child.exitCode === null) {
    first.child.kill();
    stopped.push(first.exited);
  }
  if (second?.child.exitCode === null) {
    second.child.kill();
    stopped.push(second.exited);
  }
  await Promise.all(stopped);
  await rm(root, { recursive: true, force: true });
}

const ingestRoot = await mkdtemp(join(tmpdir(), "distilly-engine-built-ingest-"));
let left;
let right;
try {
  const { createInternalEngineComposition } = await import("../lib/ingest/composition.js");
  await createInternalEngineComposition({ root: ingestRoot });
  left = startIngestChild(ingestRoot, `req_${"1".repeat(32)}`);
  right = startIngestChild(ingestRoot, `req_${"2".repeat(32)}`);
  const [leftExit, rightExit] = await withDeadline(
    Promise.all([left.exited, right.exited]),
    15_000,
    "built ingest children",
  );
  assert.deepEqual(leftExit, { code: 0, signal: null }, left.stderr);
  assert.deepEqual(rightExit, { code: 0, signal: null }, right.stderr);
  const results = [left.stdout, right.stdout].map((stdout) => {
    const line = stdout
      .trim()
      .split("\n")
      .find((candidate) => candidate.startsWith("result:"));
    assert.notEqual(line, undefined, `missing ingest result in ${JSON.stringify(stdout)}`);
    return JSON.parse(line.slice("result:".length));
  });
  assert.equal(results.filter((result) => result.kind === "success").length, 1);
  assert.equal(results.filter((result) => result.kind === "already_exists").length, 1);
} finally {
  const stopped = [];
  if (left?.child.exitCode === null) {
    left.child.kill();
    stopped.push(left.exited);
  }
  if (right?.child.exitCode === null) {
    right.child.kill();
    stopped.push(right.exited);
  }
  await Promise.all(stopped);
  await rm(ingestRoot, { recursive: true, force: true });
}

const commitRoot = await mkdtemp(join(tmpdir(), "distilly-engine-built-commit-"));
const commitPayloadFile = join(commitRoot, "commit-payload.json");
const leftCommitRequest = `req_${"6".repeat(32)}`;
const rightCommitRequest = `req_${"7".repeat(32)}`;
let commitLeft;
let commitRight;
try {
  const { createInternalEngineComposition } = await import("../lib/ingest/composition.js");
  const { Layout } = await import("../lib/layout.js");
  const composition = await createInternalEngineComposition({ root: commitRoot });
  const actor = { kind: "sdk", id: "built-commit-smoke" };
  const session = {
    actor,
    leaseOwner: `lease_owner_${"3".repeat(32)}`,
    capacity: {
      maximumInputTokens: 1_000_000,
      maximumToolResultBytes: 1_000_000,
      source: "sdk_explicit",
    },
  };
  const ingest = await composition.ingest.ingest(
    {
      subject: {
        kind: "create",
        input: {
          displayName: "Grace Hopper",
          aliases: ["Grace"],
          identityHints: [{ kind: "url", value: "https://example.com/grace" }],
        },
      },
      materials: [
        {
          clientRef: "built-commit-source",
          kind: "web",
          content: "Grace Hopper built reliable computing systems.",
          source: {
            uri: "https://example.com/grace",
            medium: "article",
            access: "public",
            role: "reference",
            capturedAt: "2026-08-21T00:00:00.000Z",
          },
          derivation: { kind: "native_text" },
        },
      ],
      enqueue: "now",
    },
    actor,
    { requestId: `req_${"4".repeat(32)}` },
  );
  assert.notEqual(ingest.job, undefined, "commit smoke ingest did not enqueue a job");
  const briefing = await composition.leases.brief({ jobId: ingest.job.id }, session, {
    requestId: `req_${"5".repeat(32)}`,
  });
  const input = {
    jobId: briefing.job.id,
    generation: briefing.job.generation,
    leaseId: briefing.lease.id,
    briefContractDigest: briefing.contract.digest,
    materialSetHash: briefing.job.materialSetHash,
    patch: {
      operations: [
        {
          op: "add",
          claim: {
            facet: "identity.biography",
            text: "Grace Hopper built reliable computing systems.",
            evidence: [
              {
                kind: "brief_material",
                materialRef: "m001",
                quote: "Grace Hopper built reliable computing systems.",
              },
            ],
          },
        },
      ],
    },
  };
  await writeFile(commitPayloadFile, `${JSON.stringify({ input, session })}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
  const layout = new Layout(commitRoot);
  const eventDirectory = join(layout.subjectDirectory(ingest.subject.id), "events");
  const eventsBefore = new Set(await readdir(eventDirectory));

  commitLeft = startCommitChild(commitRoot, commitPayloadFile, leftCommitRequest);
  commitRight = startCommitChild(commitRoot, commitPayloadFile, rightCommitRequest);
  const [leftExit, rightExit] = await withDeadline(
    Promise.all([commitLeft.exited, commitRight.exited]),
    15_000,
    "built commit children",
  );
  assert.deepEqual(leftExit, { code: 0, signal: null }, commitLeft.stderr);
  assert.deepEqual(rightExit, { code: 0, signal: null }, commitRight.stderr);
  const results = [
    { requestId: leftCommitRequest, stdout: commitLeft.stdout },
    { requestId: rightCommitRequest, stdout: commitRight.stdout },
  ].map(({ requestId, stdout }) => {
    const line = stdout
      .trim()
      .split("\n")
      .find((candidate) => candidate.startsWith("result:"));
    assert.notEqual(line, undefined, `missing commit result in ${JSON.stringify(stdout)}`);
    return { requestId, value: JSON.parse(line.slice("result:".length)) };
  });
  const winner = results.find(({ value }) => value.kind === "success");
  const loser = results.find(({ value }) => value.kind === "stale_job");
  assert.notEqual(winner, undefined, "exactly one commit process must succeed");
  assert.notEqual(loser, undefined, "exactly one commit process must become stale");
  assert.equal(results.filter(({ value }) => value.kind === "success").length, 1);
  assert.equal(results.filter(({ value }) => value.kind === "stale_job").length, 1);
  assert.deepEqual(await composition.leases.pending({}), []);

  const state = JSON.parse(await readFile(layout.stateFile(ingest.subject.id), "utf8"));
  assert.equal(state.currentVersionId, winner.value.result.version.id);
  assert.equal(state.suspendedVersionId, undefined);
  assert.equal(state.pending, undefined);
  const versionEntries = (
    await readdir(layout.versionsDirectory(ingest.subject.id), {
      withFileTypes: true,
    })
  ).filter((entry) => entry.isDirectory() && entry.name !== ".staging");
  assert.deepEqual(
    versionEntries.map((entry) => entry.name),
    [state.currentVersionId],
    "concurrent commit must publish exactly one immutable version",
  );

  const winnerOperation = JSON.parse(
    await readFile(layout.operationFile(winner.requestId), "utf8"),
  );
  const winnerJournal = JSON.parse(
    await readFile(layout.transactionFile(winner.requestId), "utf8"),
  );
  assert.equal(winnerOperation.result.version.id, state.currentVersionId);
  assert.equal(winnerJournal.state, "committed");
  assert.equal(winnerJournal.version.id, state.currentVersionId);
  const newEvents = (await readdir(eventDirectory))
    .filter((entry) => !eventsBefore.has(entry))
    .sort();
  assert.deepEqual(
    newEvents,
    winnerJournal.events.map((event) => `${event.eventId}.json`).sort(),
    "concurrent commit must durably write exactly its two journaled events",
  );
  await assert.rejects(access(layout.operationFile(loser.requestId)), { code: "ENOENT" });
  await assert.rejects(access(layout.transactionFile(loser.requestId)), { code: "ENOENT" });
} finally {
  const stopped = [];
  if (commitLeft?.child.exitCode === null) {
    commitLeft.child.kill();
    stopped.push(commitLeft.exited);
  }
  if (commitRight?.child.exitCode === null) {
    commitRight.child.kill();
    stopped.push(commitRight.exited);
  }
  await Promise.all(stopped);
  await rm(commitRoot, { recursive: true, force: true });
}

process.stdout.write("engine built prompt, lock, ingest, and commit smoke passed\n");
