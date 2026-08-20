import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const rootModule = await import("../lib/index.js");
assert.deepEqual(Object.keys(rootModule), [], "the Engine root export must remain empty");

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

  const [firstExit, secondExit] = await Promise.all([first.exited, second.exited]);
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

process.stdout.write("engine built lock smoke passed\n");
