import { randomBytes } from "node:crypto";
import { constants } from "node:fs";
import { chmod, link, lstat, mkdir, open, rename, rm, unlink } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { storageCorrupt } from "../internal-errors.js";
import { assertNoSymlinkPath, isMissing } from "./safe-fs.js";

/** Fault-injection hooks used only by atomicity tests. */
export interface AtomicWriteHooks {
  readonly afterTemporarySync?: () => void | Promise<void>;
  readonly beforeCommit?: () => void | Promise<void>;
  readonly afterCommit?: () => void | Promise<void>;
}

const temporarySibling = (path: string): string =>
  join(dirname(path), `.${basename(path)}.${process.pid}.${randomBytes(8).toString("hex")}.tmp`);

const alreadyExists = (path: string): NodeJS.ErrnoException =>
  Object.assign(new Error(`Immutable path already exists: ${path}`), { code: "EEXIST" });

/**
 * Creates or tightens a private directory.
 *
 * @param path - Directory to create and restrict to the current user.
 */
export const ensurePrivateDirectory = async (path: string): Promise<void> => {
  await mkdir(path, { recursive: true, mode: 0o700 });
  const status = await lstat(path);
  if (status.isSymbolicLink() || !status.isDirectory()) {
    throw storageCorrupt("Private directory path is not a real directory.");
  }
  await chmod(path, 0o700);
};

/**
 * Flushes a directory entry after rename/link publication where supported.
 *
 * @param path - Directory whose metadata should be synchronized.
 */
export const syncDirectory = async (path: string): Promise<void> => {
  let handle;
  try {
    handle = await open(path, constants.O_RDONLY);
    await handle.sync();
  } catch (error) {
    if (
      process.platform === "win32" &&
      error instanceof Error &&
      "code" in error &&
      (error.code === "EACCES" || error.code === "EPERM" || error.code === "EINVAL")
    ) {
      return;
    }
    throw error;
  } finally {
    await handle?.close();
  }
};

const writeSynchronizedTemporary = async (
  target: string,
  data: string | Uint8Array,
  mode: number,
  hooks: AtomicWriteHooks,
): Promise<string> => {
  const temporary = temporarySibling(target);
  let handle;
  try {
    handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, mode);
    await handle.writeFile(data);
    await handle.sync();
    await handle.close();
    handle = undefined;
    await hooks.afterTemporarySync?.();
    return temporary;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
};

/**
 * Atomically creates or replaces one durable regular file.
 *
 * @param root - Trusted local fact root.
 * @param target - Exact regular-file path to publish.
 * @param data - Complete file contents.
 * @param hooks - Optional fault-injection callbacks for tests.
 */
export const atomicReplaceFile = async (
  root: string,
  target: string,
  data: string | Uint8Array,
  hooks: AtomicWriteHooks = {},
): Promise<void> => {
  const parent = dirname(target);
  await assertNoSymlinkPath(root, parent);
  await ensurePrivateDirectory(parent);
  await assertNoSymlinkPath(root, parent);
  try {
    const targetStatus = await lstat(target);
    if (targetStatus.isSymbolicLink() || !targetStatus.isFile()) {
      throw storageCorrupt("Atomic-write target is not a regular file.");
    }
  } catch (error) {
    if (!isMissing(error)) throw error;
  }

  let temporary: string | undefined;
  try {
    temporary = await writeSynchronizedTemporary(target, data, 0o600, hooks);
    await hooks.beforeCommit?.();
    await rename(temporary, target);
    temporary = undefined;
    await hooks.afterCommit?.();
    await syncDirectory(parent);
  } finally {
    if (temporary !== undefined) await rm(temporary, { force: true });
  }
};

/**
 * Atomically creates one immutable durable regular file without replacement.
 *
 * @param root - Trusted local fact root.
 * @param target - Exact immutable regular-file path to publish.
 * @param data - Complete file contents.
 * @param hooks - Optional fault-injection callbacks for tests.
 */
export const atomicCreateFile = async (
  root: string,
  target: string,
  data: string | Uint8Array,
  hooks: AtomicWriteHooks = {},
): Promise<void> => {
  const parent = dirname(target);
  await assertNoSymlinkPath(root, parent);
  await ensurePrivateDirectory(parent);
  await assertNoSymlinkPath(root, parent);

  let temporary: string | undefined;
  try {
    temporary = await writeSynchronizedTemporary(target, data, 0o600, hooks);
    await hooks.beforeCommit?.();
    await link(temporary, target);
    await unlink(temporary);
    temporary = undefined;
    await hooks.afterCommit?.();
    await syncDirectory(parent);
  } finally {
    if (temporary !== undefined) await rm(temporary, { force: true });
  }
};

/**
 * Builds and atomically publishes one immutable directory on the same filesystem.
 *
 * @param root - Trusted local fact root.
 * @param target - Exact immutable directory path to publish.
 * @param populate - Callback that writes the complete temporary directory.
 * @param hooks - Optional fault-injection callbacks for tests.
 */
export const atomicCreateDirectory = async (
  root: string,
  target: string,
  populate: (temporaryDirectory: string) => Promise<void>,
  hooks: AtomicWriteHooks = {},
): Promise<void> => {
  const parent = dirname(target);
  await assertNoSymlinkPath(root, parent);
  await ensurePrivateDirectory(parent);
  await assertNoSymlinkPath(root, parent);
  try {
    const targetStatus = await lstat(target);
    if (targetStatus.isSymbolicLink()) {
      throw storageCorrupt("Immutable directory target is a symbolic link.");
    }
    throw alreadyExists(target);
  } catch (error) {
    if (!isMissing(error)) throw error;
  }
  const temporary = temporarySibling(target);
  await mkdir(temporary, { mode: 0o700 });
  let published = false;
  try {
    await populate(temporary);
    await syncDirectory(temporary);
    await hooks.afterTemporarySync?.();
    await hooks.beforeCommit?.();
    await rename(temporary, target);
    published = true;
    await hooks.afterCommit?.();
    await syncDirectory(parent);
  } finally {
    if (!published) await rm(temporary, { recursive: true, force: true });
  }
};
