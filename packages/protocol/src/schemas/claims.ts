import { z } from "zod";

import { WIRE_LIMITS } from "../json.js";
import {
  claimTextSchema,
  labelStringSchema,
  quoteStringSchema,
  reasonStringSchema,
  safeNonNegativeIntegerSchema,
} from "./common.js";
import {
  briefMaterialRefSchema,
  claimIdSchema,
  facetPathSchema,
  isoDateTimeSchema,
  materialIdSchema,
  relationIdSchema,
  subjectIdSchema,
  versionIdSchema,
} from "./ids.js";

export const coreFacetNameSchema = z.enum([
  "identity",
  "voice",
  "psyche",
  "relations",
  "boundaries",
  "texture",
  "timeline",
]);

const evidenceLocatorSchema = z
  .strictObject({
    start: safeNonNegativeIntegerSchema,
    end: safeNonNegativeIntegerSchema,
  })
  .refine((value) => value.end >= value.start, {
    path: ["end"],
    message: "end must be greater than or equal to start",
  });

export const evidenceRefSchema = z.strictObject({
  materialId: materialIdSchema,
  quote: quoteStringSchema,
  locator: evidenceLocatorSchema.optional(),
});

export const evidenceDraftSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("brief_material"),
    materialRef: briefMaterialRefSchema,
    quote: quoteStringSchema,
    locator: evidenceLocatorSchema.optional(),
  }),
  z.strictObject({
    kind: z.literal("baseline_evidence"),
    claimId: claimIdSchema,
    evidenceIndex: safeNonNegativeIntegerSchema,
  }),
]);

export const claimDraftSchema = z.strictObject({
  facet: facetPathSchema,
  text: claimTextSchema,
  evidence: z.array(evidenceDraftSchema).min(1).max(WIRE_LIMITS.evidencePerOperation),
  observedIn: z.array(labelStringSchema).max(WIRE_LIMITS.smallArrayItems).optional(),
  validFrom: isoDateTimeSchema.optional(),
  validTo: isoDateTimeSchema.optional(),
});

export const claimOperationSchema = z.discriminatedUnion("op", [
  z.strictObject({ op: z.literal("add"), claim: claimDraftSchema }),
  z.strictObject({
    op: z.literal("revise"),
    claimId: claimIdSchema,
    replacement: claimDraftSchema,
    reason: reasonStringSchema,
  }),
  z.strictObject({
    op: z.literal("supersede"),
    claimId: claimIdSchema,
    reason: reasonStringSchema,
    evidence: z.array(evidenceDraftSchema).min(1).max(WIRE_LIMITS.evidencePerOperation),
  }),
  z.strictObject({
    op: z.literal("contest"),
    claimId: claimIdSchema,
    reason: reasonStringSchema,
    evidence: z.array(evidenceDraftSchema).min(1).max(WIRE_LIMITS.evidencePerOperation),
  }),
]);

const relationTargetSchema = z.union([
  z.strictObject({ subjectId: subjectIdSchema }),
  z.strictObject({ rawName: labelStringSchema }),
]);

const openLabelRecordSchema = z
  .record(labelStringSchema, labelStringSchema)
  .refine((value) => Object.keys(value).length <= WIRE_LIMITS.openRecordEntries, {
    message: `must contain at most ${WIRE_LIMITS.openRecordEntries} entries`,
  });

export const relationOperationDraftSchema = z.discriminatedUnion("op", [
  z.strictObject({
    op: z.literal("add"),
    target: relationTargetSchema,
    type: labelStringSchema,
    role: openLabelRecordSchema.optional(),
    evidence: z.array(evidenceDraftSchema).min(1).max(WIRE_LIMITS.evidencePerOperation),
  }),
  z.strictObject({
    op: z.literal("invalidate"),
    relationId: relationIdSchema,
    reason: reasonStringSchema,
    evidence: z.array(evidenceDraftSchema).min(1).max(WIRE_LIMITS.evidencePerOperation),
  }),
]);

export const distillPatchSchema = z
  .strictObject({
    operations: z.array(claimOperationSchema).max(WIRE_LIMITS.patchOperations),
    relationOperations: z
      .array(relationOperationDraftSchema)
      .max(WIRE_LIMITS.patchOperations)
      .optional(),
    reviewRequest: z.strictObject({ note: reasonStringSchema.optional() }).optional(),
    notes: reasonStringSchema.optional(),
  })
  .refine(
    (value) =>
      value.operations.length + (value.relationOperations?.length ?? 0) <=
      WIRE_LIMITS.patchOperations,
    { message: `must contain at most ${WIRE_LIMITS.patchOperations} operations` },
  );

export const claimStatusSchema = z.enum(["active", "contested", "superseded"]);

export const evidenceStrengthSchema = z.enum([
  "user_asserted",
  "single_source",
  "corroborated",
  "contested",
  "imported_unverified",
]);

export const claimSchema = z.strictObject({
  id: claimIdSchema,
  facet: facetPathSchema,
  text: claimTextSchema,
  evidence: z.array(evidenceRefSchema).min(1).max(WIRE_LIMITS.smallArrayItems),
  status: claimStatusSchema,
  strength: evidenceStrengthSchema,
  observedIn: z.array(labelStringSchema).max(WIRE_LIMITS.smallArrayItems),
  validFrom: isoDateTimeSchema.optional(),
  validTo: isoDateTimeSchema.optional(),
  createdIn: versionIdSchema,
  supersededBy: claimIdSchema.optional(),
});
