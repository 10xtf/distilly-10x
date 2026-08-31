#!/usr/bin/env node

/** Fail closed when the dry-run Engine package contains test or retired artifacts. */

import { spawnSync } from "node:child_process";
import { lstat } from "node:fs/promises";
import { isAbsolute, posix, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REQUIRED_PATHS = new Set([
  "lib/index.d.ts",
  "lib/index.js",
  "package.json",
  "prompts/host-distill-v1.md",
]);
const RETIRED_NAMES = [
  "commit-child",
  "ingest-staging",
  "legacy-file-engine",
  "lock-child",
  "space-catalog-lock",
  "space-identity-lock",
];

function repositoryPath(root, path) {
  const result = relative(root, path);
  return result === "" ? "." : result.replaceAll("\\", "/");
}

function isInside(parent, candidate) {
  const path = relative(parent, candidate);
  return path === "" || (!path.startsWith("..") && !isAbsolute(path));
}

async function requiredDirectory(path, root, label) {
  let status;
  try {
    status = await lstat(path);
  } catch (error) {
    if (error?.code === "ENOENT") {
      throw new Error(`${label}: [missing-directory] expected a real directory`);
    }
    throw error;
  }
  if (status.isSymbolicLink() || !status.isDirectory() || !isInside(root, path)) {
    throw new Error(`${label}: [unsafe-directory] expected a confined non-symlink directory`);
  }
}

function parsePackReport(stdout) {
  let report;
  try {
    report = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`packages/engine: [invalid-pack-report] ${error.message}`);
  }
  if (
    !Array.isArray(report) ||
    report.length !== 1 ||
    report[0] === null ||
    typeof report[0] !== "object" ||
    report[0].name !== "@distilly/engine" ||
    !Array.isArray(report[0].files) ||
    report[0].files.length === 0
  ) {
    throw new Error(
      "packages/engine: [invalid-pack-report] expected one @distilly/engine package with files",
    );
  }
  return report[0].files;
}

function validatePackPath(path) {
  if (
    typeof path !== "string" ||
    path.length === 0 ||
    /[\u0000-\u001f\u007f]/u.test(path) ||
    path.includes("\\") ||
    isAbsolute(path) ||
    /^[A-Za-z]:/u.test(path) ||
    posix.normalize(path) !== path
  ) {
    throw new Error(`${String(path)}: [unsafe-engine-pack-path] expected a canonical relative path`);
  }
  const segments = path.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${path}: [unsafe-engine-pack-path] path traversal is forbidden`);
  }

  const lowerSegments = segments.map((segment) => segment.toLowerCase());
  const basename = lowerSegments.at(-1);
  if (lowerSegments[0] === "lib" && lowerSegments[1] === "testing") {
    throw new Error(`${path}: [forbidden-engine-pack-path] lib/testing is test-only`);
  }
  if (lowerSegments.some((segment) => segment.includes("test-support"))) {
    throw new Error(`${path}: [forbidden-engine-pack-path] test-support is test-only`);
  }
  if (
    lowerSegments.some((segment) => /(?:^|[._-])fixtures?(?:[._-]|$)/u.test(segment))
  ) {
    throw new Error(`${path}: [forbidden-engine-pack-path] fixtures are test-only`);
  }
  if (basename?.includes(".test.")) {
    throw new Error(`${path}: [forbidden-engine-pack-path] tests are not package artifacts`);
  }
  for (const name of RETIRED_NAMES) {
    if (lowerSegments.some((segment) => segment === name || segment.startsWith(`${name}.`))) {
      throw new Error(`${path}: [forbidden-engine-pack-path] ${name} is retired`);
    }
  }
  return segments;
}

async function verifyReportedFile(engineDirectory, workspaceRoot, path, segments) {
  let current = engineDirectory;
  for (const [index, segment] of segments.entries()) {
    current = resolve(current, segment);
    if (!isInside(engineDirectory, current)) {
      throw new Error(`${path}: [unsafe-engine-pack-path] resolved path escapes packages/engine`);
    }
    let status;
    try {
      status = await lstat(current);
    } catch (error) {
      if (error?.code === "ENOENT") {
        throw new Error(`${path}: [missing-engine-pack-path] dry-run path is absent on disk`);
      }
      throw error;
    }
    if (status.isSymbolicLink()) {
      throw new Error(`${path}: [symlink-engine-pack-path] package paths cannot use symlinks`);
    }
    if (index === segments.length - 1 ? !status.isFile() : !status.isDirectory()) {
      throw new Error(
        `${repositoryPath(workspaceRoot, current)}: [invalid-engine-pack-path-kind] unexpected path kind`,
      );
    }
  }
}

/**
 * Runs npm's real dry-run pack entry and validates every reported Engine package path.
 *
 * @param {string} workspaceRoot - Repository root containing packages/engine.
 * @returns {Promise<number>} Number of verified package files.
 */
export async function checkEnginePack(workspaceRoot) {
  const root = resolve(workspaceRoot);
  await requiredDirectory(root, root, ".");
  const packagesDirectory = resolve(root, "packages");
  await requiredDirectory(packagesDirectory, root, "packages");
  const engineDirectory = resolve(packagesDirectory, "engine");
  await requiredDirectory(engineDirectory, root, "packages/engine");

  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const packed = spawnSync(npm, ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: engineDirectory,
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (packed.error !== undefined) {
    throw new Error(`packages/engine: [pack-command-failed] ${packed.error.message}`);
  }
  if (packed.status !== 0) {
    const detail = packed.stderr.trim() || packed.stdout.trim() || `exit ${packed.status}`;
    throw new Error(`packages/engine: [pack-command-failed] ${detail}`);
  }

  const entries = parsePackReport(packed.stdout);
  const paths = [];
  const seen = new Set();
  for (const entry of entries) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("packages/engine: [invalid-pack-report] file entry must be an object");
    }
    const segments = validatePackPath(entry.path);
    if (seen.has(entry.path)) {
      throw new Error(`${entry.path}: [duplicate-engine-pack-path] path appears more than once`);
    }
    seen.add(entry.path);
    paths.push({ path: entry.path, segments });
  }
  for (const required of REQUIRED_PATHS) {
    if (!seen.has(required)) {
      throw new Error(`${required}: [missing-required-engine-pack-path] expected packaged file`);
    }
  }
  for (const entry of paths) {
    await verifyReportedFile(engineDirectory, root, entry.path, entry.segments);
  }
  return paths.length;
}

async function main() {
  if (process.argv.length > 3) {
    console.error("usage: node scripts/check_engine_pack.mjs [workspace-root]");
    process.exitCode = 2;
    return;
  }
  const count = await checkEnginePack(process.argv[2] ?? process.cwd());
  console.log(`engine pack: ok (${count} files)`);
}

const invokedPath = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(`engine pack: ${error.stack ?? error.message ?? error}`);
    process.exitCode = 1;
  });
}
