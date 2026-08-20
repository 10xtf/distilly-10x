/** Real CLI fixtures for TypeScript workspace package-boundary enforcement. */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHECKER = resolve(ROOT, "scripts/check_package_boundaries.mjs");

async function workspace(
  testContext,
  {
    protocolSource,
    engineSource,
    protocolDependencies = {},
    engineDependencies = {},
  },
) {
  const root = await mkdtemp(join(tmpdir(), "distilly-package-boundaries-"));
  testContext.after(() => rm(root, { force: true, recursive: true }));
  const fixtures = [
    [
      "protocol",
      "@distilly/protocol",
      protocolSource,
      protocolDependencies,
    ],
    ["engine", "@distilly/engine", engineSource, engineDependencies],
  ];
  for (const [directory, name, source, dependencies] of fixtures) {
    const packageDirectory = resolve(root, "packages", directory);
    await mkdir(resolve(packageDirectory, "src"), { recursive: true });
    await writeFile(
      resolve(packageDirectory, "package.json"),
      `${JSON.stringify({ name, type: "module", dependencies })}\n`,
      "utf8",
    );
    await writeFile(resolve(packageDirectory, "src/index.ts"), source, "utf8");
  }
  return root;
}

function run(root) {
  const result = spawnSync(process.execPath, [CHECKER, root], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.ifError(result.error);
  return result;
}

test("accepts engine to protocol", async (testContext) => {
  const root = await workspace(testContext, {
    protocolSource:
      'import type { ZodType } from "zod";\nexport type Schema = ZodType;\n',
    engineSource:
      'import type { EngineClient } from "@distilly/protocol";\nexport type Client = EngineClient;\n',
    engineDependencies: { "@distilly/protocol": "workspace:*" },
  });

  const result = run(root);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "package boundaries: ok\n");
  assert.equal(result.stderr, "");
});

test("accepts allowed internal npm and workspace aliases", async (testContext) => {
  const root = await workspace(testContext, {
    protocolSource: "export interface EngineClient {}\n",
    engineSource:
      'import type { EngineClient as NpmClient } from "protocol-npm";\n' +
      'import type { EngineClient as WorkspaceClient } from "protocol-workspace/subpath";\n' +
      'import type { EngineClient as RelativeClient } from "protocol-relative";\n' +
      'import type { EngineClient as LinkClient } from "protocol-link";\n' +
      'import type { EngineClient as FileClient } from "protocol-file";\n' +
      'import type { EngineClient as DirectoryClient } from "protocol-directory";\n' +
      "export type Clients = NpmClient | WorkspaceClient | RelativeClient | LinkClient | FileClient | DirectoryClient;\n",
    engineDependencies: {
      "protocol-npm": "npm:@distilly/protocol@1.0.0",
      "protocol-workspace": "workspace:@distilly/protocol@*",
      "protocol-relative": "workspace:../protocol",
      "protocol-link": "link:../protocol",
      "protocol-file": "file:../protocol",
      "protocol-directory": "../protocol",
    },
  });

  const result = run(root);

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, "package boundaries: ok\n");
  assert.equal(result.stderr, "");
});

test("rejects protocol to engine dependency and import", async (testContext) => {
  const root = await workspace(testContext, {
    protocolSource:
      'export type { EngineRuntime } from "@distilly/engine";\n',
    engineSource: "export interface EngineRuntime {}\n",
    protocolDependencies: { "@distilly/engine": "workspace:*" },
  });

  const result = run(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[forbidden-internal-dependency]/);
  assert.match(result.stderr, /\[forbidden-internal-import]/);
  assert.match(
    result.stderr,
    /@distilly\/protocol may not depend on @distilly\/engine/,
  );
});

for (const [aliasKind, aliasSpecifier, dependencyName] of [
  ["npm", "npm:@distilly/engine@1.0.0", "engine-npm"],
  ["workspace", "workspace:@distilly/engine@*", "engine-workspace"],
  ["relative workspace", "workspace:../engine", "engine-relative"],
  ["link", "link:../engine", "engine-link"],
  ["file", "file:../engine", "engine-file"],
  ["directory", "../engine", "engine-directory"],
]) {
  test(`rejects protocol to engine through ${aliasKind} alias`, async (testContext) => {
    const root = await workspace(testContext, {
      protocolSource: `export type { EngineRuntime } from "${dependencyName}";\n`,
      engineSource: "export interface EngineRuntime {}\n",
      protocolDependencies: { [dependencyName]: aliasSpecifier },
    });

    const result = run(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[forbidden-internal-dependency]/);
    assert.match(result.stderr, /\[forbidden-internal-import]/);
    assert.match(
      result.stderr,
      /@distilly\/protocol may not depend on @distilly\/engine/,
    );
  });
}

for (const [aliasKind, protocolSpecifier, engineSpecifier] of [
  ["link", "link:../engine", "link:../protocol"],
  ["file", "file:../engine", "file:../protocol"],
  ["directory", "../engine", "../protocol"],
]) {
  test(`rejects a cycle through ${aliasKind} dependency aliases`, async (testContext) => {
    const root = await workspace(testContext, {
      protocolSource: 'export type { EngineRuntime } from "hidden-engine";\n',
      engineSource: 'export type { EngineClient } from "hidden-protocol";\n',
      protocolDependencies: { "hidden-engine": protocolSpecifier },
      engineDependencies: { "hidden-protocol": engineSpecifier },
    });

    const result = run(root);

    assert.equal(result.status, 1);
    assert.match(result.stderr, /\[forbidden-internal-dependency]/);
    assert.match(result.stderr, /\[forbidden-internal-import]/);
    assert.match(result.stderr, /\[dependency-cycle]/);
  });
}

test("rejects a cycle in the real source import graph", async (testContext) => {
  const root = await workspace(testContext, {
    protocolSource:
      'export type { EngineRuntime } from "@distilly/engine";\n',
    engineSource:
      'export type { EngineClient } from "@distilly/protocol";\n',
  });

  const result = run(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[dependency-cycle]/);
  assert.match(result.stderr, /@distilly\/engine, @distilly\/protocol/);
});

test("rejects a computed import that the boundary gate cannot resolve", async (
  testContext,
) => {
  const root = await workspace(testContext, {
    protocolSource: "export interface EngineClient {}\n",
    engineSource:
      'const packageName = "@distilly/protocol";\nvoid import(packageName);\n',
  });

  const result = run(root);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[non-static-module-specifier]/);
  assert.match(result.stderr, /dynamic import target must be a string literal/);
});
