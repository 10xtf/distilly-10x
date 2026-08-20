import { requestIdSchema } from "@distilly/protocol";
import { mkdir, mkdtemp, rm, stat, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Layout } from "../layout.js";
import { FileRequestLock } from "./request-lock.js";
import { FileSpaceCatalogLock } from "./space-catalog-lock.js";

const REQUEST_ID = requestIdSchema.parse(`req_${"0".repeat(32)}`);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const makeRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-step5-locks-"));
  roots.push(root);
  return root;
};

describe("Step 5 root lock wrappers", () => {
  it("serializes request and space-catalog ownership at their canonical paths", async () => {
    const root = await makeRoot();
    const layout = new Layout(root);
    const requests = new FileRequestLock(layout);
    const catalog = new FileSpaceCatalogLock(layout);

    const requestLease = await requests.acquire(REQUEST_ID);
    await expect(requests.acquire(REQUEST_ID)).rejects.toMatchObject({ code: "busy" });
    if (process.platform !== "win32") {
      expect((await stat(layout.requestLock(REQUEST_ID))).mode & 0o777).toBe(0o700);
    }
    await requestLease.release();

    const catalogLease = await catalog.acquire();
    await expect(catalog.acquire()).rejects.toMatchObject({ code: "busy" });
    await catalogLease.release();
  });

  it("rejects a symlink at a root lock path", async () => {
    const root = await makeRoot();
    const outside = await makeRoot();
    const layout = new Layout(root);
    const path = layout.requestLock(REQUEST_ID);
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await symlink(outside, path);

    await expect(new FileRequestLock(layout).acquire(REQUEST_ID)).rejects.toMatchObject({
      code: "storage_corrupt",
    });
  });
});
