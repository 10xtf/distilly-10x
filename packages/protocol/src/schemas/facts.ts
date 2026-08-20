import { z } from "zod";

import { WIRE_LIMITS } from "../json.js";
import type { MutationMethodName } from "../methods.js";
import type {
  EventRecord,
  FactEnvelope,
  IngestTransactionRecord,
  PendingJobMarker,
  SpaceRecord,
  StoredOperationResult,
  SubjectRecord,
  SubjectStateRecord,
  VersionMaterialEntry,
} from "../values/facts.js";
import type { VersionMaterialManifest, VersionRecord } from "../values/versions.js";
import {
  labelStringSchema,
  safeNonNegativeIntegerSchema,
  safePositiveIntegerSchema,
} from "./common.js";
import type { MatchingSchema } from "./common.js";
import { actorContextSchema } from "./context.js";
import { engineEventSchema } from "./events.js";
import {
  bundleExportResultSchema,
  bundleImportResultSchema,
  exportRefSchema,
  installRefSchema,
} from "./hosts.js";
import { hostDistillBriefingSchema, jobLeaseSchema, pendingJobSchema } from "./jobs.js";
import { ingestFilesResultSchema, ingestResultSchema } from "./materials.js";
import {
  contentDigestSchema,
  eventIdSchema,
  factChecksumSchema,
  isoDateTimeSchema,
  jobIdSchema,
  materialIdSchema,
  materialSetHashSchema,
  provenanceDigestSchema,
  requestIdSchema,
  spaceIdSchema,
  subjectIdSchema,
  versionIdSchema,
} from "./ids.js";
import { qualitySummarySchema, rebuildResultSchema } from "./profiles.js";
import { identityHintSchema, subjectLifecycleSchema, subjectSummarySchema } from "./subjects.js";
import {
  commitResultSchema,
  createdDispositionSchema,
  versionCreationSchema,
  versionSummarySchema,
} from "./versions.js";

const schemaFor =
  <T>() =>
  <S extends z.ZodType>(schema: S & MatchingSchema<S, T>): S =>
    schema;

const factEnvelopeV1Shape = {
  schemaVersion: z.literal(1),
  checksum: factChecksumSchema,
} as const;

/** Runtime schema for the shared fact integrity envelope. */
export const factEnvelopeSchema = schemaFor<FactEnvelope>()(
  z.strictObject({
    schemaVersion: safePositiveIntegerSchema,
    checksum: factChecksumSchema,
  }),
);

/** Runtime schema for a persisted space namespace. */
export const spaceRecordSchema = schemaFor<SpaceRecord>()(
  z.strictObject({
    ...factEnvelopeV1Shape,
    id: spaceIdSchema,
    displayName: labelStringSchema,
    kind: z.enum(["people", "fictional", "custom"]),
  }),
);

/** Runtime schema for persisted subject identity. */
export const subjectRecordSchema = schemaFor<SubjectRecord>()(
  z.strictObject({
    ...factEnvelopeV1Shape,
    id: subjectIdSchema,
    spaceId: spaceIdSchema,
    displayName: labelStringSchema,
    aliases: z.array(labelStringSchema).max(WIRE_LIMITS.smallArrayItems),
    identityHints: z.array(identityHintSchema).max(WIRE_LIMITS.smallArrayItems),
    domainPack: labelStringSchema.optional(),
    lifecycle: subjectLifecycleSchema,
  }),
);

/** Runtime schema for digest-only material membership. */
export const versionMaterialEntrySchema = schemaFor<VersionMaterialEntry>()(
  z.strictObject({
    materialId: materialIdSchema,
    contentDigest: contentDigestSchema,
    provenanceDigest: provenanceDigestSchema,
  }),
);

const sortedMaterialEntriesSchema = z
  .array(versionMaterialEntrySchema)
  .superRefine((items, context) => {
    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1];
      const current = items[index];
      if (
        previous !== undefined &&
        current !== undefined &&
        previous.materialId >= current.materialId
      ) {
        context.addIssue({
          code: "custom",
          path: [index, "materialId"],
          message: "material entries must be strictly ordered by MaterialId",
        });
      }
    }
  });

/** Runtime schema for the fact-owned subset of pending job state. */
export const pendingJobMarkerSchema = schemaFor<PendingJobMarker>()(
  z
    .strictObject({
      jobId: jobIdSchema,
      generation: safeNonNegativeIntegerSchema,
      baseVersionId: versionIdSchema.optional(),
      materialSetHash: materialSetHashSchema,
      addedMaterialCount: safeNonNegativeIntegerSchema,
      totalMaterialCount: safeNonNegativeIntegerSchema,
      queuedAt: isoDateTimeSchema,
    })
    .superRefine((marker, context) => {
      if (marker.addedMaterialCount > marker.totalMaterialCount) {
        context.addIssue({
          code: "custom",
          path: ["addedMaterialCount"],
          message: "added material count cannot exceed total material count",
        });
      }
    }),
);

/** Runtime schema for authoritative current subject state. */
export const subjectStateRecordSchema = schemaFor<SubjectStateRecord>()(
  z
    .strictObject({
      ...factEnvelopeV1Shape,
      subjectId: subjectIdSchema,
      generation: safeNonNegativeIntegerSchema,
      materialSetHash: materialSetHashSchema.optional(),
      materialManifest: sortedMaterialEntriesSchema,
      currentVersionId: versionIdSchema.optional(),
      suspendedVersionId: versionIdSchema.optional(),
      pending: pendingJobMarkerSchema.optional(),
    })
    .superRefine((state, context) => {
      if (state.materialManifest.length === 0) {
        if (state.generation !== 0) {
          context.addIssue({
            code: "custom",
            path: ["generation"],
            message: "an empty subject must have generation zero",
          });
        }
        if (state.materialSetHash !== undefined) {
          context.addIssue({
            code: "custom",
            path: ["materialSetHash"],
            message: "an empty subject cannot have a material-set hash",
          });
        }
        if (state.pending !== undefined) {
          context.addIssue({
            code: "custom",
            path: ["pending"],
            message: "an empty subject cannot have pending distillation work",
          });
        }
        return;
      }

      if (state.generation === 0) {
        context.addIssue({
          code: "custom",
          path: ["generation"],
          message: "a non-empty subject must have a positive generation",
        });
      }
      if (state.materialSetHash === undefined) {
        context.addIssue({
          code: "custom",
          path: ["materialSetHash"],
          message: "a non-empty subject requires a material-set hash",
        });
      }

      if (state.pending !== undefined) {
        if (state.pending.generation !== state.generation) {
          context.addIssue({
            code: "custom",
            path: ["pending", "generation"],
            message: "pending generation must match subject state",
          });
        }
        if (state.pending.materialSetHash !== state.materialSetHash) {
          context.addIssue({
            code: "custom",
            path: ["pending", "materialSetHash"],
            message: "pending material-set hash must match subject state",
          });
        }
        if (state.pending.totalMaterialCount !== state.materialManifest.length) {
          context.addIssue({
            code: "custom",
            path: ["pending", "totalMaterialCount"],
            message: "pending total count must match the subject manifest",
          });
        }
      }
    }),
);

/** Runtime schema for one durable engine event. */
export const eventRecordSchema = schemaFor<EventRecord>()(
  z
    .strictObject({
      ...factEnvelopeV1Shape,
      eventId: eventIdSchema,
      event: engineEventSchema,
      actor: actorContextSchema,
      requestId: requestIdSchema.optional(),
    })
    .superRefine((record, context) => {
      if (record.requestId === undefined && record.actor.kind !== "system") {
        context.addIssue({
          code: "custom",
          path: ["requestId"],
          message: "only system events may omit a request id",
        });
      }
    }),
);

/** Runtime schema for immutable persisted version metadata. */
export const versionRecordSchema = schemaFor<VersionRecord>()(
  z.strictObject({
    ...factEnvelopeV1Shape,
    id: versionIdSchema,
    subjectId: subjectIdSchema,
    parentId: versionIdSchema.optional(),
    derivedFromCandidateVersionId: versionIdSchema.optional(),
    generation: safeNonNegativeIntegerSchema,
    materialSetHash: materialSetHashSchema,
    materialCount: safeNonNegativeIntegerSchema,
    creation: versionCreationSchema,
    createdDisposition: createdDispositionSchema,
    actor: actorContextSchema,
    quality: qualitySummarySchema,
    rendererVersion: labelStringSchema,
    createdAt: isoDateTimeSchema,
  }),
);

/** Runtime schema for historical version material membership. */
export const versionMaterialManifestSchema = schemaFor<VersionMaterialManifest>()(
  z.strictObject({
    ...factEnvelopeV1Shape,
    items: sortedMaterialEntriesSchema,
  }),
);

const operationRecordVariant = <M extends MutationMethodName, S extends z.ZodType>(
  method: M,
  result: S & MatchingSchema<S, StoredOperationResult<M>>,
) =>
  z.strictObject({
    ...factEnvelopeV1Shape,
    requestId: requestIdSchema,
    method: z.literal(method),
    actor: actorContextSchema,
    inputChecksum: factChecksumSchema,
    result,
    completedAt: isoDateTimeSchema,
  });

const emptyResultSchema = z.null();

const operationRecordVariants = {
  "subjects.create": operationRecordVariant("subjects.create", subjectSummarySchema),
  "subjects.archive": operationRecordVariant("subjects.archive", emptyResultSchema),
  "subjects.purge": operationRecordVariant("subjects.purge", emptyResultSchema),
  "materials.ingest": operationRecordVariant("materials.ingest", ingestResultSchema),
  "materials.ingestFiles": operationRecordVariant("materials.ingestFiles", ingestFilesResultSchema),
  "distill.brief": operationRecordVariant("distill.brief", hostDistillBriefingSchema),
  "distill.renew": operationRecordVariant("distill.renew", jobLeaseSchema),
  "distill.release": operationRecordVariant("distill.release", emptyResultSchema),
  "distill.commit": operationRecordVariant("distill.commit", commitResultSchema),
  "distill.redistill": operationRecordVariant("distill.redistill", pendingJobSchema),
  "profiles.correct": operationRecordVariant("profiles.correct", commitResultSchema),
  "versions.promote": operationRecordVariant("versions.promote", versionSummarySchema),
  "versions.reject": operationRecordVariant("versions.reject", versionSummarySchema),
  "versions.rollback": operationRecordVariant("versions.rollback", versionSummarySchema),
  "hosts.install": operationRecordVariant("hosts.install", installRefSchema),
  "hosts.uninstall": operationRecordVariant("hosts.uninstall", emptyResultSchema),
  "hosts.export": operationRecordVariant("hosts.export", exportRefSchema),
  "library.rebuild": operationRecordVariant("library.rebuild", rebuildResultSchema),
  "bundles.import": operationRecordVariant("bundles.import", bundleImportResultSchema),
  "bundles.export": operationRecordVariant("bundles.export", bundleExportResultSchema),
} satisfies { readonly [M in MutationMethodName]: z.ZodType };

/** Runtime discriminated union for all successful mutation records. */
export const operationRecordSchema = z.discriminatedUnion("method", [
  operationRecordVariants["subjects.create"],
  operationRecordVariants["subjects.archive"],
  operationRecordVariants["subjects.purge"],
  operationRecordVariants["materials.ingest"],
  operationRecordVariants["materials.ingestFiles"],
  operationRecordVariants["distill.brief"],
  operationRecordVariants["distill.renew"],
  operationRecordVariants["distill.release"],
  operationRecordVariants["distill.commit"],
  operationRecordVariants["distill.redistill"],
  operationRecordVariants["profiles.correct"],
  operationRecordVariants["versions.promote"],
  operationRecordVariants["versions.reject"],
  operationRecordVariants["versions.rollback"],
  operationRecordVariants["hosts.install"],
  operationRecordVariants["hosts.uninstall"],
  operationRecordVariants["hosts.export"],
  operationRecordVariants["library.rebuild"],
  operationRecordVariants["bundles.import"],
  operationRecordVariants["bundles.export"],
]);

const ingestTransactionBaseShape = {
  ...factEnvelopeV1Shape,
  transactionKind: z.literal("ingest"),
  requestId: requestIdSchema,
  subjectId: subjectIdSchema,
  createdSubject: z.boolean(),
  previousStateChecksum: factChecksumSchema.optional(),
  targetStateChecksum: factChecksumSchema,
  newMaterials: sortedMaterialEntriesSchema.max(WIRE_LIMITS.ingestMaterials),
  operation: operationRecordVariants["materials.ingest"],
  events: z.array(eventRecordSchema).max(3),
  preparedAt: isoDateTimeSchema,
} as const;

const actorsEqual = (
  left: { readonly kind: string; readonly id: string; readonly host?: string | undefined },
  right: { readonly kind: string; readonly id: string; readonly host?: string | undefined },
): boolean => left.kind === right.kind && left.id === right.id && left.host === right.host;

/** Runtime discriminated union for a crash-recoverable ingest journal. */
export const ingestTransactionRecordSchema = schemaFor<IngestTransactionRecord>()(
  z
    .discriminatedUnion("state", [
      z.strictObject({
        ...ingestTransactionBaseShape,
        state: z.literal("prepared"),
      }),
      z.strictObject({
        ...ingestTransactionBaseShape,
        state: z.literal("committed"),
        finishedAt: isoDateTimeSchema,
      }),
      z.strictObject({
        ...ingestTransactionBaseShape,
        state: z.literal("aborted"),
        finishedAt: isoDateTimeSchema,
      }),
    ])
    .superRefine((transaction, context) => {
      if (transaction.createdSubject && transaction.previousStateChecksum !== undefined) {
        context.addIssue({
          code: "custom",
          path: ["previousStateChecksum"],
          message: "a create ingest cannot have previous subject state",
        });
      }
      if (!transaction.createdSubject && transaction.previousStateChecksum === undefined) {
        context.addIssue({
          code: "custom",
          path: ["previousStateChecksum"],
          message: "an existing-subject ingest requires its previous state checksum",
        });
      }
      if (transaction.operation.requestId !== transaction.requestId) {
        context.addIssue({
          code: "custom",
          path: ["operation", "requestId"],
          message: "operation request id must match the ingest journal",
        });
      }

      const result = transaction.operation.result;
      if (result.subject.id !== transaction.subjectId) {
        context.addIssue({
          code: "custom",
          path: ["operation", "result", "subject", "id"],
          message: "operation result subject must match the ingest journal",
        });
      }
      if (result.job !== undefined && result.job.subjectId !== transaction.subjectId) {
        context.addIssue({
          code: "custom",
          path: ["operation", "result", "job", "subjectId"],
          message: "operation result job must belong to the journal subject",
        });
      }

      const resultCreated = result.kind === "ingested" && result.created;
      if (transaction.createdSubject !== resultCreated) {
        context.addIssue({
          code: "custom",
          path: ["createdSubject"],
          message: "journal subject creation must match the stored ingest result",
        });
      }

      const acceptedItems = result.items.filter((item) => item.kind === "accepted");
      const acceptedByMaterialId = new Map(
        acceptedItems.map((item) => [item.materialId, item.contentDigest] as const),
      );
      if (
        acceptedItems.length !== transaction.newMaterials.length ||
        acceptedByMaterialId.size !== acceptedItems.length ||
        transaction.newMaterials.some(
          (entry) => acceptedByMaterialId.get(entry.materialId) !== entry.contentDigest,
        )
      ) {
        context.addIssue({
          code: "custom",
          path: ["newMaterials"],
          message: "journal materials must match the accepted operation result items",
        });
      }

      const requiredEventKinds: string[] = [];
      if (transaction.createdSubject) requiredEventKinds.push("subject.created");
      if (transaction.newMaterials.length !== 0) requiredEventKinds.push("material.ingested");
      if (result.kind === "ingested" && result.job !== undefined) {
        requiredEventKinds.push("job.changed");
      }
      const actualEventKinds = transaction.events.map((record) => record.event.kind);
      const optionalUnchangedJobEvent = result.kind === "unchanged" && result.job !== undefined;
      const allowedEventSequences = optionalUnchangedJobEvent
        ? [requiredEventKinds, [...requiredEventKinds, "job.changed"]]
        : [requiredEventKinds];
      const eventsAreComplete = allowedEventSequences.some(
        (sequence) =>
          sequence.length === actualEventKinds.length &&
          sequence.every((kind, index) => kind === actualEventKinds[index]),
      );
      if (!eventsAreComplete) {
        context.addIssue({
          code: "custom",
          path: ["events"],
          message: "journal events must be the complete applicable ingest event sequence",
        });
      }

      const eventIds = new Set<string>();
      for (const [index, record] of transaction.events.entries()) {
        if (eventIds.has(record.eventId)) {
          context.addIssue({
            code: "custom",
            path: ["events", index, "eventId"],
            message: "ingest event ids must be unique",
          });
        }
        eventIds.add(record.eventId);
        if (record.event.subjectId !== transaction.subjectId) {
          context.addIssue({
            code: "custom",
            path: ["events", index, "event", "subjectId"],
            message: "ingest event subject must match the journal",
          });
        }
        if (record.requestId !== transaction.requestId) {
          context.addIssue({
            code: "custom",
            path: ["events", index, "requestId"],
            message: "ingest event request id must match the journal",
          });
        }
        if (!actorsEqual(record.actor, transaction.operation.actor)) {
          context.addIssue({
            code: "custom",
            path: ["events", index, "actor"],
            message: "ingest event actor must match the stored operation",
          });
        }
      }
    }),
);
