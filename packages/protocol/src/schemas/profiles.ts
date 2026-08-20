import { z } from "zod";

import { WIRE_LIMITS } from "../json.js";
import {
  correctionTextSchema,
  labelStringSchema,
  listLimitSchema,
  queryStringSchema,
  safeNonNegativeIntegerSchema,
} from "./common.js";
import { claimSchema, coreFacetNameSchema } from "./claims.js";
import {
  claimIdSchema,
  facetPathSchema,
  isoDateTimeSchema,
  spaceIdSchema,
  subjectIdSchema,
  versionIdSchema,
} from "./ids.js";
import {
  maturitySchema,
  subjectLifecycleSchema,
  subjectStatusSchema,
  subjectSummarySchema,
} from "./subjects.js";

export const qualitySummarySchema = z.strictObject({
  sourceGroupingVersion: labelStringSchema,
  activeClaimCount: safeNonNegativeIntegerSchema,
  contestedClaimCount: safeNonNegativeIntegerSchema,
  userAssertedClaimCount: safeNonNegativeIntegerSchema,
  corroboratedClaimCount: safeNonNegativeIntegerSchema,
  sourceGroupCount: safeNonNegativeIntegerSchema,
  diversityEligibleSourceGroupCount: safeNonNegativeIntegerSchema,
  unknownSourceGroupCount: safeNonNegativeIntegerSchema,
  coveredCoreFacets: z.array(coreFacetNameSchema).max(7),
  uncoveredCoreFacets: z.array(coreFacetNameSchema).max(7),
  maturity: maturitySchema,
});

const profileCoreSchema = z.strictObject({
  identity: z.string().min(1),
  voice: z.string().min(1),
  psyche: z.string().min(1),
  relations: z.string().min(1),
  boundaries: z.string().min(1),
  texture: z.string().min(1),
  timeline: z.string().min(1),
});

const profileDomainsSchema = z
  .record(labelStringSchema, z.string().min(1))
  .refine((value) => Object.keys(value).length <= WIRE_LIMITS.openRecordEntries, {
    message: `must contain at most ${WIRE_LIMITS.openRecordEntries} entries`,
  });

export const profileSchema = z.strictObject({
  subjectId: subjectIdSchema,
  versionId: versionIdSchema,
  claims: z.array(claimSchema),
  core: profileCoreSchema,
  domains: profileDomainsSchema,
  rendered: z.string().min(1),
  quality: qualitySummarySchema,
});

export const profileDiffSchema = z.strictObject({
  added: z.array(claimSchema),
  removed: z.array(claimSchema),
  changedFacets: z.array(facetPathSchema).max(WIRE_LIMITS.smallArrayItems),
  beforeQuality: qualitySummarySchema,
  afterQuality: qualitySummarySchema,
});

export const getProfileInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  versionId: versionIdSchema.optional(),
});

export const correctionDraftSchema = z.strictObject({
  text: correctionTextSchema,
  facet: facetPathSchema.optional(),
  supersedes: z.array(claimIdSchema).max(WIRE_LIMITS.smallArrayItems).optional(),
  baseCandidateVersionId: versionIdSchema.optional(),
});

export const correctInputSchema = z.strictObject({
  subjectId: subjectIdSchema,
  correction: correctionDraftSchema,
});

export const libraryEntrySchema = z.strictObject({
  subject: subjectSummarySchema,
  status: subjectStatusSchema,
  pendingJobs: safeNonNegativeIntegerSchema,
  suspendedVersions: safeNonNegativeIntegerSchema,
  lastChangedAt: isoDateTimeSchema,
});

export const libraryQuerySchema = z.strictObject({
  text: queryStringSchema.optional(),
  spaceId: spaceIdSchema.optional(),
  lifecycle: subjectLifecycleSchema.optional(),
  hasPending: z.boolean().optional(),
  hasSuspended: z.boolean().optional(),
  cursor: labelStringSchema.optional(),
  limit: listLimitSchema.optional(),
});

export const libraryPageSchema = z.strictObject({
  items: z.array(libraryEntrySchema).max(WIRE_LIMITS.listLimit),
  nextCursor: labelStringSchema.optional(),
});

export const rebuildResultSchema = z.strictObject({
  subjects: safeNonNegativeIntegerSchema,
  jobs: safeNonNegativeIntegerSchema,
  relations: safeNonNegativeIntegerSchema,
  rebuiltAt: isoDateTimeSchema,
});

export const renderedPromptSchema = z.string().min(1);
