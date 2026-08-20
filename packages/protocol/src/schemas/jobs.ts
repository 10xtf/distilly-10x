import { z } from "zod";

import { WIRE_LIMITS } from "../json.js";
import {
  labelStringSchema,
  listLimitSchema,
  materialContentSchema,
  reasonStringSchema,
  safeNonNegativeIntegerSchema,
  safePositiveIntegerSchema,
} from "./common.js";
import { claimSchema } from "./claims.js";
import {
  briefContractDigestSchema,
  briefMaterialRefSchema,
  contentDigestSchema,
  isoDateTimeSchema,
  jobIdSchema,
  leaseIdSchema,
  materialIdSchema,
  materialSetHashSchema,
  subjectIdSchema,
  versionIdSchema,
} from "./ids.js";
import {
  materialRecordKindSchema,
  materialSourceSchema,
  sourceGroupSchema,
  textDerivationSchema,
} from "./materials.js";
import { qualitySummarySchema } from "./profiles.js";
import { subjectSummarySchema } from "./subjects.js";
import { distillyErrorCodeSchema } from "./wire.js";

export const publicJobStateSchema = z.enum(["pending", "leased", "failed"]);

export const pendingJobSchema = z.strictObject({
  id: jobIdSchema,
  subjectId: subjectIdSchema,
  generation: safeNonNegativeIntegerSchema,
  baseVersionId: versionIdSchema.optional(),
  materialSetHash: materialSetHashSchema,
  addedMaterialCount: safeNonNegativeIntegerSchema,
  totalMaterialCount: safeNonNegativeIntegerSchema,
  state: publicJobStateSchema,
  queuedAt: isoDateTimeSchema,
  leaseExpiresAt: isoDateTimeSchema.optional(),
  failure: z
    .strictObject({
      code: distillyErrorCodeSchema,
      retryable: z.boolean(),
      remediation: reasonStringSchema.optional(),
    })
    .optional(),
});

export const pendingFilterSchema = z.strictObject({
  subjectId: subjectIdSchema.optional(),
  state: publicJobStateSchema.optional(),
  limit: listLimitSchema.optional(),
});

export const briefContractSchema = z.strictObject({
  digest: briefContractDigestSchema,
  sourceGroupingVersion: labelStringSchema,
  promptVersion: labelStringSchema,
  draftSchemaVersion: safePositiveIntegerSchema,
});

export const jobLeaseSchema = z.strictObject({
  id: leaseIdSchema,
  jobId: jobIdSchema,
  generation: safeNonNegativeIntegerSchema,
  briefContractDigest: briefContractDigestSchema,
  owner: labelStringSchema,
  acquiredAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
});

export const briefMaterialSchema = z.strictObject({
  ref: briefMaterialRefSchema,
  materialId: materialIdSchema,
  contentDigest: contentDigestSchema,
  kind: z.lazy(() => materialRecordKindSchema),
  content: materialContentSchema,
  source: z.lazy(() => materialSourceSchema),
  derivation: z.lazy(() => textDerivationSchema),
  sourceGroup: z.lazy(() => sourceGroupSchema),
  sensitivity: z.enum(["private", "shareable"]),
});

export const briefEvidenceFactSchema = z.strictObject({
  materialId: materialIdSchema,
  source: z.lazy(() => materialSourceSchema),
  derivation: z.lazy(() => textDerivationSchema),
  sourceGroup: z.lazy(() => sourceGroupSchema),
  sensitivity: z.enum(["private", "shareable"]),
  flags: z.array(z.literal("suspicious_source")).max(WIRE_LIMITS.smallArrayItems),
});

export const hostDistillContractSchema = z.strictObject({
  ...briefContractSchema.shape,
  instructions: reasonStringSchema,
  evidenceRules: z.array(reasonStringSchema).max(WIRE_LIMITS.smallArrayItems),
});

export const hostDistillBriefingSchema = z.strictObject({
  job: pendingJobSchema,
  lease: jobLeaseSchema,
  subject: subjectSummarySchema,
  baseline: z
    .strictObject({
      versionId: versionIdSchema,
      claims: z.array(claimSchema),
      quality: qualitySummarySchema,
      evidenceFacts: z.array(briefEvidenceFactSchema),
    })
    .optional(),
  materials: z.array(briefMaterialSchema),
  contract: hostDistillContractSchema,
  limits: z.strictObject({
    estimatedInputTokens: safeNonNegativeIntegerSchema,
    maximumInputTokens: safePositiveIntegerSchema,
    maximumOutputBytes: safePositiveIntegerSchema,
  }),
});

export const briefInputSchema = z.strictObject({ jobId: jobIdSchema });

export const renewLeaseInputSchema = z.strictObject({
  jobId: jobIdSchema,
  leaseId: leaseIdSchema,
});

export const releaseLeaseInputSchema = z.strictObject({
  jobId: jobIdSchema,
  leaseId: leaseIdSchema,
  reason: reasonStringSchema.optional(),
});

export const redistillInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  mode: z.enum(["incremental", "full"]),
  reason: reasonStringSchema,
});
