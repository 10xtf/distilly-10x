import { z } from "zod";

import { WIRE_LIMITS } from "../json.js";
import {
  labelStringSchema,
  listLimitSchema,
  reasonStringSchema,
  safeNonNegativeIntegerSchema,
  safePositiveIntegerSchema,
} from "./common.js";
import { distillPatchSchema } from "./claims.js";
import {
  briefContractDigestSchema,
  claimIdSchema,
  contentDigestSchema,
  eventIdSchema,
  facetPathSchema,
  isoDateTimeSchema,
  jobIdSchema,
  leaseIdSchema,
  materialIdSchema,
  materialSetHashSchema,
  subjectIdSchema,
  versionIdSchema,
} from "./ids.js";
import { actorContextSchema } from "./context.js";
import { profileDiffSchema, profileSchema, qualitySummarySchema } from "./profiles.js";

export const reviewReasonSchema = z.discriminatedUnion("code", [
  z.strictObject({
    code: z.literal("identity_changed"),
    claimIds: z.array(claimIdSchema).max(WIRE_LIMITS.smallArrayItems),
  }),
  z.strictObject({
    code: z.literal("coverage_decreased"),
    facets: z.array(facetPathSchema).max(WIRE_LIMITS.smallArrayItems),
  }),
  z.strictObject({
    code: z.literal("voice_examples_removed"),
    claimIds: z.array(claimIdSchema).max(WIRE_LIMITS.smallArrayItems),
  }),
  z.strictObject({
    code: z.literal("new_contested_claims"),
    claimIds: z.array(claimIdSchema).max(WIRE_LIMITS.smallArrayItems),
  }),
  z.strictObject({
    code: z.literal("correction_conflict"),
    claimIds: z.array(claimIdSchema).max(WIRE_LIMITS.smallArrayItems),
  }),
  z.strictObject({ code: z.literal("source_diversity_decreased") }),
  z.strictObject({
    code: z.literal("suspicious_source"),
    materialIds: z.array(materialIdSchema).max(WIRE_LIMITS.smallArrayItems),
  }),
  z.strictObject({
    code: z.literal("relayed_correction"),
    actorKind: z.enum(["host", "sdk", "executor", "system"]),
  }),
  z.strictObject({ code: z.literal("imported_profile") }),
  z.strictObject({
    code: z.literal("manual_review_requested"),
    note: reasonStringSchema.optional(),
  }),
]);

export const reviewReasonsSchema = z
  .tuple([reviewReasonSchema], reviewReasonSchema)
  .refine((reasons) => reasons.length <= WIRE_LIMITS.smallArrayItems, {
    message: `must contain at most ${WIRE_LIMITS.smallArrayItems} items`,
  });

export const versionStatusSchema = z.enum(["current", "suspended", "historical", "rejected"]);
export const createdDispositionSchema = z.enum(["current", "suspended"]);

export const versionCreationSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("host_distill"),
    briefContractDigest: briefContractDigestSchema,
    promptVersion: labelStringSchema,
    draftSchemaVersion: safePositiveIntegerSchema,
  }),
  z.strictObject({
    kind: z.literal("correction"),
    correctionMaterialId: materialIdSchema,
  }),
  z.strictObject({
    kind: z.literal("rollback"),
    targetVersionId: versionIdSchema,
  }),
  z.strictObject({
    kind: z.literal("bundle_import"),
    bundleDigest: contentDigestSchema,
  }),
  z.strictObject({
    kind: z.literal("renderer_only"),
    sourceVersionId: versionIdSchema,
  }),
]);

export const versionSummarySchema = z.strictObject({
  id: versionIdSchema,
  subjectId: subjectIdSchema,
  parentId: versionIdSchema.optional(),
  derivedFromCandidateVersionId: versionIdSchema.optional(),
  generation: safeNonNegativeIntegerSchema,
  materialSetHash: materialSetHashSchema,
  creation: versionCreationSchema,
  status: versionStatusSchema,
  actor: actorContextSchema,
  quality: qualitySummarySchema,
  createdAt: isoDateTimeSchema,
});

export const currentVersionSummarySchema = versionSummarySchema.extend({
  status: z.literal("current"),
});

export const suspendedVersionSummarySchema = versionSummarySchema.extend({
  status: z.literal("suspended"),
});

export const reviewRefSchema = z.strictObject({
  subjectId: subjectIdSchema,
  candidateVersionId: versionIdSchema,
});

const REVIEW_LAUNCH_URL_PATTERN =
  /^http:\/\/127\.0\.0\.1:([1-9][0-9]{0,4})\/#([0-9a-f]{64})\/review\/(subject_[0-9a-f]{32})\/(version_[0-9a-f]{64})$/;

const reviewLaunchUrlSchema = z
  .string()
  .regex(REVIEW_LAUNCH_URL_PATTERN)
  .refine((url) => {
    const match = REVIEW_LAUNCH_URL_PATTERN.exec(url);
    return match !== null && Number(match[1]) <= 65_535;
  }, "must use a valid explicit TCP port");

export const reviewLaunchSchema = z
  .strictObject({
    ref: reviewRefSchema,
    url: reviewLaunchUrlSchema,
  })
  .superRefine((launch, context) => {
    const match = REVIEW_LAUNCH_URL_PATTERN.exec(launch.url);
    if (
      match === null ||
      match[3] !== launch.ref.subjectId ||
      match[4] !== launch.ref.candidateVersionId
    ) {
      context.addIssue({
        code: "custom",
        path: ["url"],
        message: "review route must match ref",
      });
    }
  });

export const commitInputSchema = z.strictObject({
  jobId: jobIdSchema,
  generation: safeNonNegativeIntegerSchema,
  leaseId: leaseIdSchema,
  briefContractDigest: briefContractDigestSchema,
  materialSetHash: materialSetHashSchema,
  baseVersionId: versionIdSchema.optional(),
  patch: distillPatchSchema,
});

export const commitResultSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("current"),
    version: currentVersionSummarySchema,
    profile: profileSchema,
  }),
  z.strictObject({
    kind: z.literal("suspended"),
    candidate: suspendedVersionSummarySchema,
    currentVersionId: versionIdSchema.optional(),
    reasons: reviewReasonsSchema,
    review: reviewRefSchema,
  }),
]);

export const diffInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  before: versionIdSchema,
  after: versionIdSchema,
});

export const reviewActionInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  candidateVersionId: versionIdSchema,
  reason: reasonStringSchema.optional(),
});

export const rollbackInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  targetVersionId: versionIdSchema,
  reason: reasonStringSchema,
});

export const lineageInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  cursor: labelStringSchema.optional(),
  limit: listLimitSchema.optional(),
});

export const lineageEventSchema = z.strictObject({
  eventId: eventIdSchema,
  kind: z.enum([
    "created",
    "committed",
    "suspended",
    "promoted",
    "rejected",
    "candidate_replaced",
    "rolled_back",
    "corrected",
    "imported",
  ]),
  versionId: versionIdSchema.optional(),
  relatedVersionId: versionIdSchema.optional(),
  actor: actorContextSchema,
  at: isoDateTimeSchema,
  reason: reasonStringSchema.optional(),
});

export const reviewQuerySchema = z.strictObject({
  subjectId: subjectIdSchema.optional(),
  cursor: labelStringSchema.optional(),
  limit: listLimitSchema.optional(),
});

export const reviewItemSchema = z.strictObject({
  candidate: suspendedVersionSummarySchema,
  current: currentVersionSummarySchema.optional(),
  reasons: reviewReasonsSchema,
  diff: profileDiffSchema,
});

export const versionSummaryListSchema = z.array(versionSummarySchema);

export const lineageEventListSchema = z.array(lineageEventSchema).max(WIRE_LIMITS.listLimit);

export const reviewItemListSchema = z.array(reviewItemSchema).max(WIRE_LIMITS.listLimit);
