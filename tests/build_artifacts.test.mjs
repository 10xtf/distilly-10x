/** Real CLI fixtures for reproducible build cleanup and Engine package validation. */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLEANER = resolve(ROOT, "scripts/clean_build_outputs.mjs");
const PACK_CHECKER = resolve(ROOT, "scripts/check_engine_pack.mjs");

function run(script, root, options = {}) {
  const result = spawnSync(process.execPath, [script, root], {
    cwd: ROOT,
    encoding: "utf8",
    ...options,
  });
  assert.ifError(result.error);
  return result;
}

async function temporaryRoot(testContext, prefix) {
  const root = await mkdtemp(join(tmpdir(), prefix));
  testContext.after(() => rm(root, { force: true, recursive: true }));
  return root;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function buildWorkspace(testContext, references = ["packages/alpha"]) {
  const root = await temporaryRoot(testContext, "distilly-build-clean-");
  await writeJson(resolve(root, "tsconfig.json"), {
    files: [],
    references: references.map((path) => ({ path })),
  });
  await mkdir(resolve(root, "packages/alpha/lib"), { recursive: true });
  await writeFile(resolve(root, "packages/alpha/lib/stale.js"), "stale\n", "utf8");
  return root;
}

async function engineWorkspace(testContext, extraPaths = []) {
  const root = await temporaryRoot(testContext, "distilly-engine-pack-");
  const engine = resolve(root, "packages/engine");
  await writeJson(resolve(engine, "package.json"), {
    name: "@distilly/engine",
    version: "0.0.0",
    type: "module",
    files: ["lib", "prompts", "scripts"],
  });
  const files = new Map([
    ["lib/index.d.ts", "export {};\n"],
    ["lib/index.js", "export {};\n"],
    ["prompts/host-distill-v1.md", "# Prompt\n"],
    ...extraPaths.map((path) => [path, "fixture\n"]),
  ]);
  for (const [path, content] of files) {
    const target = resolve(engine, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  return root;
}

test("cleaner removes only direct-reference package lib directories", async (testContext) => {
  const root = await buildWorkspace(testContext);
  await mkdir(resolve(root, "packages/unreferenced/lib"), { recursive: true });
  await writeFile(resolve(root, "packages/unreferenced/lib/keep.js"), "keep\n", "utf8");

  const result = run(CLEANER, root);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "build outputs cleaned: 1\n");
  assert.equal(result.stderr, "");
  await assert.rejects(access(resolve(root, "packages/alpha/lib")), { code: "ENOENT" });
  assert.equal(
    await readFile(resolve(root, "packages/unreferenced/lib/keep.js"), "utf8"),
    "keep\n",
  );
});

test("cleaner validates every reference before deleting and rejects path escape", async (
  testContext,
) => {
  const root = await buildWorkspace(testContext, ["packages/alpha", "../outside"]);

  const result = run(CLEANER, root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[unsafe-reference\]/u);
  assert.equal(await readFile(resolve(root, "packages/alpha/lib/stale.js"), "utf8"), "stale\n");
});

test("cleaner refuses a symlink lib without touching its target", async (testContext) => {
  const root = await buildWorkspace(testContext);
  await rm(resolve(root, "packages/alpha/lib"), { recursive: true });
  const outside = await temporaryRoot(testContext, "distilly-build-outside-");
  await writeFile(resolve(outside, "sentinel"), "keep\n", "utf8");
  await symlink(outside, resolve(root, "packages/alpha/lib"), "dir");

  const result = run(CLEANER, root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[symlink-build-output\]/u);
  assert.equal(await readFile(resolve(outside, "sentinel"), "utf8"), "keep\n");
});

test("Engine pack accepts remaining production modules", async (testContext) => {
  const root = await engineWorkspace(testContext, [
    "lib/distill/commit-service.js",
    "lib/projection/json-library-projection.js",
  ]);

  const result = run(PACK_CHECKER, root);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^engine pack: ok \([1-9][0-9]* files\)\n$/u);
  assert.equal(result.stderr, "");
});

test(
  "Engine pack rejects an unsafe dry-run path",
  { skip: process.platform === "win32" },
  async (testContext) => {
    const root = await engineWorkspace(testContext);
    const bin = resolve(root, "bin");
    const fakeNpm = resolve(bin, "npm");
    await mkdir(bin, { recursive: true });
    await writeFile(
      fakeNpm,
      "#!/usr/bin/env node\n" +
        `process.stdout.write(${JSON.stringify(
          JSON.stringify([
            {
              name: "@distilly/engine",
              files: [
                { path: "package.json" },
                { path: "lib/index.js" },
                { path: "lib/index.d.ts" },
                { path: "prompts/host-distill-v1.md" },
                { path: "../escape.js" },
              ],
            },
          ]),
        )});\n`,
      "utf8",
    );
    await chmod(fakeNpm, 0o755);

    const result = run(PACK_CHECKER, root, {
      env: { ...process.env, PATH: `${bin}:${process.env.PATH ?? ""}` },
    });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[unsafe-engine-pack-path\]/u);
  },
);

for (const forbiddenPath of [
  "lib/testing/fake-client.js",
  "lib/facts/version-fixture.test-support.js",
  "lib/person.fixture.js",
  "lib/facts/transaction-store.js",
  "lib/queue/sqlite-projection.js",
  "lib/review/service.js",
  "lib/transaction/recovery.js",
  "lib/transaction/version-staging.js",
  "lib/transaction/ingest-staging.js",
  "lib/transaction/space-catalog-lock.js",
  "lib/transaction/space-identity-lock.js",
  "lib/legacy-file-engine.js",
  "scripts/commit-child.mjs",
  "scripts/lock-child.mjs",
]) {
  test(`Engine pack rejects ${forbiddenPath}`, async (testContext) => {
    const root = await engineWorkspace(testContext, [forbiddenPath]);

    const result = run(PACK_CHECKER, root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[forbidden-engine-pack-path\]/u);
    assert.match(result.stderr, new RegExp(forbiddenPath.split("/").at(-1).split(".")[0], "u"));
  });
}
