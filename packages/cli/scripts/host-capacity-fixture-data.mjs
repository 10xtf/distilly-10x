import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import { distillyMcpTools } from "@distilly/protocol";

export const TARGET_BRIEFING_BYTES = 16_384;
export const TARGET_TOOL_RESULT_BYTES = 65_536;
export const PROMPT_TAIL = "5d630b9597e64edb96f9153ecfd26e39";
export const BRIEF_TAIL = "f79bd02c62aa452daed7682bcff4f4cd";

const HEX_32 = "a".repeat(32);
const HEX_64 = "b".repeat(64);
export const SUBJECT_ID = `subject_${HEX_32}`;
const JOB_ID = `job_${HEX_32}`;

const subject = {
  id: SUBJECT_ID,
  displayName: "Capacity Boundary Fixture",
  aliases: [],
  identityHints: [],
  space: { id: `space_${HEX_32}`, displayName: "People", kind: "people" },
  lifecycle: "active",
};

const source = {
  uri: "https://example.test/distilly-capacity-fixture",
  medium: "webpage",
  access: "public",
  capturedAt: "2026-08-31T00:00:00.000Z",
  authors: [],
};

const createBriefing = (content) => ({
  job: {
    id: JOB_ID,
    subjectId: SUBJECT_ID,
    generation: 1,
    materialSetHash: `set_sha256_${HEX_64}`,
    addedMaterialCount: 1,
    totalMaterialCount: 1,
    state: "leased",
    queuedAt: "2026-08-31T00:00:00.000Z",
    leaseExpiresAt: "2026-08-31T00:30:00.000Z",
  },
  lease: {
    id: `lease_${HEX_32}`,
    jobId: JOB_ID,
    generation: 1,
    briefContractDigest: `brief_contract_${HEX_64}`,
    owner: `lease_owner_${HEX_32}`,
    acquiredAt: "2026-08-31T00:00:00.000Z",
    expiresAt: "2026-08-31T00:30:00.000Z",
  },
  subject,
  materials: [
    {
      ref: "m001",
      materialId: `mat_${HEX_64}`,
      contentDigest: `sha256_${HEX_64}`,
      kind: "web",
      content,
      source,
      derivation: { kind: "native_text" },
      sourceGroup: {
        key: `sg_${HEX_64}`,
        bases: ["canonical_uri"],
        diversityStatus: "eligible",
        cautions: [],
      },
      sensitivity: "shareable",
    },
  ],
  contract: {
    digest: `brief_contract_${HEX_64}`,
    sourceGroupingVersion: "source-groups-v1",
    promptVersion: `host-distill-v1-sha256_${HEX_64}`,
    draftSchemaVersion: 1,
    instructions: "Read the complete fixture without truncation.",
    evidenceRules: ["Preserve the final boundary marker."],
  },
  limits: {
    estimatedInputTokens: TARGET_BRIEFING_BYTES,
    maximumInputTokens: TARGET_BRIEFING_BYTES,
    maximumOutputBytes: TARGET_TOOL_RESULT_BYTES,
  },
});

const fillToBytes = (factory, targetBytes, tail) => {
  const prefix = "BEGIN_BOUNDARY_FIXTURE\n";
  const base = factory(`${prefix}${tail}`);
  const missing = targetBytes - Buffer.byteLength(JSON.stringify(base), "utf8");
  assert.ok(missing >= 0, "capacity fixture target is smaller than its fixed envelope");
  const value = factory(`${prefix}${"x".repeat(missing)}${tail}`);
  assert.equal(Buffer.byteLength(JSON.stringify(value), "utf8"), targetBytes);
  return value;
};

export const briefing = fillToBytes(createBriefing, TARGET_BRIEFING_BYTES, `TAIL=${BRIEF_TAIL}`);

const promptOutput = (prompt) => ({
  ok: true,
  wireVersion: "3",
  value: { kind: "prompt", subject, prompt },
});

const promptEnvelope = fillToBytes(promptOutput, TARGET_TOOL_RESULT_BYTES, `TAIL=${PROMPT_TAIL}`);
export const prompt = promptEnvelope.value.prompt;

export const expectedPromptOutput = promptEnvelope;
export const expectedBriefingOutput = {
  ok: true,
  wireVersion: "3",
  value: { kind: "briefing", briefing },
};

export const promptToolInput = {
  wireVersion: "3",
  requestId: `req_${"1".repeat(32)}`,
  action: "prompt",
  subject: { kind: "id", subjectId: SUBJECT_ID },
};

export const briefingToolInput = {
  wireVersion: "3",
  requestId: `req_${"2".repeat(32)}`,
  action: "brief",
  jobId: JOB_ID,
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort((left, right) => Buffer.compare(Buffer.from(left), Buffer.from(right)))
      .map((key) => [key, canonicalize(value[key])]),
  );
};

export const canonicalJson = (value) => JSON.stringify(canonicalize(value));
export const sha256 = (value) => `sha256_${createHash("sha256").update(value).digest("hex")}`;

export const toolContractDigest = sha256(
  canonicalJson(
    distillyMcpTools.map(
      ({ name, title, description, inputSchema, outputSchema, annotations }) => ({
        name,
        title,
        description,
        inputSchema,
        outputSchema,
        annotations,
      }),
    ),
  ),
);
