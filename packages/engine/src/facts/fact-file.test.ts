import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { FactEnvelope, RuntimeSchema } from "@distilly/protocol";

import { sealFact } from "./checksum.js";
import { createFactFile, readFactFile } from "./fact-file.js";

interface LargeFact extends FactEnvelope<1> {
  readonly payload: string;
}

const largeFactSchema: RuntimeSchema<LargeFact> = {
  parse(value) {
    if (
      typeof value !== "object" ||
      value === null ||
      (value as { readonly schemaVersion?: unknown }).schemaVersion !== 1 ||
      typeof (value as { readonly checksum?: unknown }).checksum !== "string" ||
      typeof (value as { readonly payload?: unknown }).payload !== "string"
    ) {
      throw new Error("invalid large fact");
    }
    return value as LargeFact;
  },
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("generic fact files", () => {
  it("does not reuse the MCP input limit for an accumulating fact", async () => {
    const root = await mkdtemp(join(tmpdir(), "distilly-large-fact-"));
    roots.push(root);
    const path = join(root, "state.json");
    const fact = sealFact<LargeFact>({
      schemaVersion: 1,
      payload: "x".repeat(4_194_305),
    });

    await createFactFile(root, path, fact, largeFactSchema);

    await expect(readFactFile(root, path, largeFactSchema)).resolves.toEqual(fact);
  });
});
