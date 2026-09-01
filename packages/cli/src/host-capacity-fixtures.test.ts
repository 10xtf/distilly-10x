import { createHash } from "node:crypto";

import { BUILTIN_HOSTS, distillyMcpTools, type ContentDigest } from "@distilly/protocol";
import { describe, expect, it } from "vitest";

import codexEvidence from "./evidence/host-capacity/codex-cli-0.146.0-cli-distilly-0.1.0-preview.1-v1.json" with { type: "json" };
import { loadPreviewHostFixture } from "./host-capacity-fixtures.js";

const canonicalize = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(record)
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
      .map((key) => [key, canonicalize(record[key])]),
  );
};

const descriptorDigest = (): string => {
  const descriptors = distillyMcpTools.map(
    ({ name, title, description, inputSchema, outputSchema, annotations }) => ({
      name,
      title,
      description,
      inputSchema,
      outputSchema,
      annotations,
    }),
  );
  return `sha256_${createHash("sha256")
    .update(JSON.stringify(canonicalize(descriptors)))
    .digest("hex")}`;
};

describe("immutable Preview host capacity evidence", () => {
  it("binds the real Codex observation to the current tool contract and release", () => {
    expect(descriptorDigest()).toBe(codexEvidence.toolContractDigest);
    const preflight = loadPreviewHostFixture(
      BUILTIN_HOSTS.codex,
      codexEvidence.hostVersion,
      "cli",
      {
        releaseVersion: codexEvidence.releaseVersion,
        canonicalSkillDigest: codexEvidence.canonicalSkillDigest as ContentDigest,
      },
    );
    if (!preflight.ok) throw new TypeError("Expected the exact Codex evidence tuple to load.");
    expect(preflight.capacity).toEqual({
      maximumInputTokens: codexEvidence.capacity.maximumInputTokens,
      maximumToolResultBytes: codexEvidence.capacity.maximumToolResultBytes,
      source: "binding_fixture",
    });
    expect(preflight.evidence).toMatchObject({
      fixtureId: codexEvidence.fixtureId,
      hostVersion: codexEvidence.hostVersion,
      canonicalSkillDigest: codexEvidence.canonicalSkillDigest,
    });
  });

  it("fails closed for an exact tuple without a real evidence record", () => {
    expect(() =>
      loadPreviewHostFixture(BUILTIN_HOSTS.claudeCode, "2.1.221 (Claude Code)", "cli", {
        releaseVersion: "0.1.0-preview.1",
        canonicalSkillDigest:
          "sha256_88ac7d2b8495ffb9dc9f1c3d8a011ccc7ca05ba32bee3b03a817704012c9dc15" as ContentDigest,
      }),
    ).toThrow(/No verified capacity fixture/u);
  });
});
