import { describe, expect, expectTypeOf, it } from "vitest";

import { WIRE_LIMITS } from "./json.js";
import type { EngineMethodMap, MutationMethodName } from "./methods.js";
import {
  eventRecordSchema,
  factEnvelopeSchema,
  ingestTransactionRecordSchema,
  operationRecordSchema,
  pendingJobMarkerSchema,
  spaceRecordSchema,
  subjectRecordSchema,
  subjectStateRecordSchema,
  versionMaterialEntrySchema,
  versionMaterialManifestSchema,
  versionRecordSchema,
} from "./schemas/facts.js";
import {
  briefContractDigestSchema,
  contentDigestSchema,
  eventIdSchema,
  factChecksumSchema,
  hostNameSchema,
  isoDateTimeSchema,
  jobIdSchema,
  leaseIdSchema,
  materialIdSchema,
  materialSetHashSchema,
  provenanceDigestSchema,
  requestIdSchema,
  spaceIdSchema,
  subjectIdSchema,
  versionIdSchema,
} from "./schemas/ids.js";
import type {
  EventRecord,
  IngestTransactionRecord,
  OperationRecord,
  PendingJobMarker,
  SpaceRecord,
  SubjectRecord,
  SubjectStateRecord,
  VersionMaterialEntry,
} from "./values/facts.js";
import type { VersionMaterialManifest, VersionRecord } from "./values/versions.js";

const HEX_32 = "0".repeat(32);
const ALT_HEX_32 = "1".repeat(32);
const THIRD_HEX_32 = "2".repeat(32);
const HEX_64 = "0".repeat(64);
const ALT_HEX_64 = "1".repeat(64);

const subjectId = subjectIdSchema.parse(`subject_${HEX_32}`);
const otherSubjectId = subjectIdSchema.parse(`subject_${ALT_HEX_32}`);
const spaceId = spaceIdSchema.parse(`space_${HEX_32}`);
const materialId = materialIdSchema.parse(`mat_${HEX_64}`);
const secondMaterialId = materialIdSchema.parse(`mat_${ALT_HEX_64}`);
const contentDigest = contentDigestSchema.parse(`sha256_${HEX_64}`);
const secondContentDigest = contentDigestSchema.parse(`sha256_${ALT_HEX_64}`);
const provenanceDigest = provenanceDigestSchema.parse(`provenance_sha256_${HEX_64}`);
const secondProvenanceDigest = provenanceDigestSchema.parse(`provenance_sha256_${ALT_HEX_64}`);
const materialSetHash = materialSetHashSchema.parse(`set_sha256_${HEX_64}`);
const versionId = versionIdSchema.parse(`version_${HEX_64}`);
const candidateVersionId = versionIdSchema.parse(`version_${ALT_HEX_64}`);
const jobId = jobIdSchema.parse(`job_${HEX_32}`);
const leaseId = leaseIdSchema.parse(`lease_${HEX_32}`);
const requestId = requestIdSchema.parse(`req_${HEX_32}`);
const otherRequestId = requestIdSchema.parse(`req_${ALT_HEX_32}`);
const eventId = eventIdSchema.parse(`event_${HEX_32}`);
const factChecksum = factChecksumSchema.parse(`fact_sha256_${HEX_64}`);
const otherFactChecksum = factChecksumSchema.parse(`fact_sha256_${ALT_HEX_64}`);
const briefContractDigest = briefContractDigestSchema.parse(`brief_contract_${HEX_64}`);
const host = hostNameSchema.parse("codex");
const at = isoDateTimeSchema.parse("2026-08-20T00:00:00.000Z");
const finishedAt = isoDateTimeSchema.parse("2026-08-20T00:01:00.000Z");

const actor = { kind: "sdk", id: "sdk-test" } as const;

const space = {
  id: spaceId,
  displayName: "People",
  kind: "people",
} as const;

const subject = {
  id: subjectId,
  displayName: "Ada",
  aliases: ["A"],
  identityHints: [{ kind: "url", value: "https://example.com/ada" }],
  space,
  lifecycle: "active",
  currentVersionId: versionId,
} as const;

const quality = {
  sourceGroupingVersion: "source-groups-v1",
  activeClaimCount: 0,
  contestedClaimCount: 0,
  userAssertedClaimCount: 0,
  corroboratedClaimCount: 0,
  sourceGroupCount: 1,
  diversityEligibleSourceGroupCount: 1,
  unknownSourceGroupCount: 0,
  coveredCoreFacets: ["identity"],
  uncoveredCoreFacets: ["voice", "psyche", "relations", "boundaries", "texture", "timeline"],
  maturity: "forming",
} as const;

const currentVersion = {
  id: versionId,
  subjectId,
  generation: 1,
  materialSetHash,
  creation: {
    kind: "host_distill",
    briefContractDigest,
    promptVersion: "host-distill-v1",
    draftSchemaVersion: 1,
  },
  status: "current",
  actor,
  quality,
  createdAt: at,
} as const;

const suspendedVersion = {
  ...currentVersion,
  id: candidateVersionId,
  parentId: versionId,
  creation: { kind: "bundle_import", bundleDigest: contentDigest },
  status: "suspended",
} as const;

const profile = {
  subjectId,
  versionId,
  claims: [],
  core: {
    identity: "Ada writes.",
    voice: "Direct.",
    psyche: "Unassessed.",
    relations: "Unassessed.",
    boundaries: "Unassessed.",
    texture: "Unassessed.",
    timeline: "Unassessed.",
  },
  domains: {},
  rendered: "# Ada",
  quality,
} as const;

const pendingJob = {
  id: jobId,
  subjectId,
  generation: 1,
  baseVersionId: versionId,
  materialSetHash,
  addedMaterialCount: 1,
  totalMaterialCount: 1,
  state: "pending",
  queuedAt: at,
} as const;

const lease = {
  id: leaseId,
  jobId,
  generation: 1,
  briefContractDigest,
  owner: "sdk-test",
  acquiredAt: at,
  expiresAt: finishedAt,
} as const;

const briefing = {
  job: pendingJob,
  lease,
  subject,
  materials: [],
  contract: {
    digest: briefContractDigest,
    sourceGroupingVersion: "source-groups-v1",
    promptVersion: "host-distill-v1",
    draftSchemaVersion: 1,
    instructions: "Distill evidence-bounded claims.",
    evidenceRules: [],
  },
  limits: {
    estimatedInputTokens: 1,
    maximumInputTokens: 4_096,
    maximumOutputBytes: 65_536,
  },
} as const;

const ingestItem = {
  clientRef: "source-1",
  kind: "accepted",
  materialId,
  contentDigest,
} as const;

const ingestResult = {
  kind: "ingested",
  subject,
  created: false,
  items: [ingestItem],
  materialSetHash,
  generation: 1,
  job: pendingJob,
} as const;

const commitResult = {
  kind: "current",
  version: currentVersion,
  profile,
} as const;

const installRef = {
  id: "install-1",
  host,
  subjectId,
  versionId,
  path: "/tmp/distilly/ada.md",
  contentDigest,
  installedAt: at,
} as const;

const exportRef = {
  host,
  subjectId,
  versionId,
  path: "/tmp/distilly/ada-export.md",
  contentDigest,
} as const;

const mutationMethods = [
  "subjects.create",
  "subjects.archive",
  "subjects.purge",
  "materials.ingest",
  "materials.ingestFiles",
  "distill.brief",
  "distill.renew",
  "distill.release",
  "distill.commit",
  "distill.redistill",
  "profiles.correct",
  "versions.promote",
  "versions.reject",
  "versions.rollback",
  "hosts.install",
  "hosts.uninstall",
  "hosts.export",
  "library.rebuild",
  "bundles.import",
  "bundles.export",
] as const satisfies readonly MutationMethodName[];

const mutationResults = {
  "subjects.create": subject,
  "subjects.archive": null,
  "subjects.purge": null,
  "materials.ingest": ingestResult,
  "materials.ingestFiles": {
    subject,
    created: false,
    items: [],
    generation: 1,
    materialSetHash,
    job: pendingJob,
  },
  "distill.brief": briefing,
  "distill.renew": lease,
  "distill.release": null,
  "distill.commit": commitResult,
  "distill.redistill": pendingJob,
  "profiles.correct": commitResult,
  "versions.promote": currentVersion,
  "versions.reject": { ...suspendedVersion, status: "rejected" },
  "versions.rollback": {
    ...currentVersion,
    id: candidateVersionId,
    parentId: versionId,
    creation: { kind: "rollback", targetVersionId: versionId },
  },
  "hosts.install": installRef,
  "hosts.uninstall": null,
  "hosts.export": exportRef,
  "library.rebuild": { subjects: 1, jobs: 1, relations: 0, rebuiltAt: at },
  "bundles.import": {
    subject,
    candidate: suspendedVersion,
    review: { subjectId, candidateVersionId },
  },
  "bundles.export": { path: "/tmp/ada.distilly-profile", contentDigest },
} satisfies {
  readonly [M in MutationMethodName]: EngineMethodMap[M]["result"];
};

const operationBase = {
  schemaVersion: 1,
  checksum: factChecksum,
  requestId,
  actor,
  inputChecksum: otherFactChecksum,
  completedAt: at,
} as const;

const operationRecords = {
  "subjects.create": {
    ...operationBase,
    method: "subjects.create",
    result: mutationResults["subjects.create"],
  },
  "subjects.archive": {
    ...operationBase,
    method: "subjects.archive",
    result: mutationResults["subjects.archive"],
  },
  "subjects.purge": {
    ...operationBase,
    method: "subjects.purge",
    result: mutationResults["subjects.purge"],
  },
  "materials.ingest": {
    ...operationBase,
    method: "materials.ingest",
    result: mutationResults["materials.ingest"],
  },
  "materials.ingestFiles": {
    ...operationBase,
    method: "materials.ingestFiles",
    result: mutationResults["materials.ingestFiles"],
  },
  "distill.brief": {
    ...operationBase,
    method: "distill.brief",
    result: mutationResults["distill.brief"],
  },
  "distill.renew": {
    ...operationBase,
    method: "distill.renew",
    result: mutationResults["distill.renew"],
  },
  "distill.release": {
    ...operationBase,
    method: "distill.release",
    result: mutationResults["distill.release"],
  },
  "distill.commit": {
    ...operationBase,
    method: "distill.commit",
    result: mutationResults["distill.commit"],
  },
  "distill.redistill": {
    ...operationBase,
    method: "distill.redistill",
    result: mutationResults["distill.redistill"],
  },
  "profiles.correct": {
    ...operationBase,
    method: "profiles.correct",
    result: mutationResults["profiles.correct"],
  },
  "versions.promote": {
    ...operationBase,
    method: "versions.promote",
    result: mutationResults["versions.promote"],
  },
  "versions.reject": {
    ...operationBase,
    method: "versions.reject",
    result: mutationResults["versions.reject"],
  },
  "versions.rollback": {
    ...operationBase,
    method: "versions.rollback",
    result: mutationResults["versions.rollback"],
  },
  "hosts.install": {
    ...operationBase,
    method: "hosts.install",
    result: mutationResults["hosts.install"],
  },
  "hosts.uninstall": {
    ...operationBase,
    method: "hosts.uninstall",
    result: mutationResults["hosts.uninstall"],
  },
  "hosts.export": {
    ...operationBase,
    method: "hosts.export",
    result: mutationResults["hosts.export"],
  },
  "library.rebuild": {
    ...operationBase,
    method: "library.rebuild",
    result: mutationResults["library.rebuild"],
  },
  "bundles.import": {
    ...operationBase,
    method: "bundles.import",
    result: mutationResults["bundles.import"],
  },
  "bundles.export": {
    ...operationBase,
    method: "bundles.export",
    result: mutationResults["bundles.export"],
  },
} satisfies { readonly [M in MutationMethodName]: OperationRecord<M> };

const wrongResults = {
  "subjects.create": pendingJob,
  "subjects.archive": subject,
  "subjects.purge": subject,
  "materials.ingest": pendingJob,
  "materials.ingestFiles": pendingJob,
  "distill.brief": lease,
  "distill.renew": pendingJob,
  "distill.release": subject,
  "distill.commit": subject,
  "distill.redistill": lease,
  "profiles.correct": subject,
  "versions.promote": subject,
  "versions.reject": subject,
  "versions.rollback": subject,
  "hosts.install": exportRef,
  "hosts.uninstall": subject,
  "hosts.export": installRef,
  "library.rebuild": mutationResults["bundles.export"],
  "bundles.import": mutationResults["bundles.export"],
  "bundles.export": mutationResults["library.rebuild"],
} satisfies { readonly [M in MutationMethodName]: unknown };

const firstEntry = {
  materialId,
  contentDigest,
  provenanceDigest,
} satisfies VersionMaterialEntry;

const secondEntry = {
  materialId: secondMaterialId,
  contentDigest: secondContentDigest,
  provenanceDigest: secondProvenanceDigest,
} satisfies VersionMaterialEntry;

const pendingMarker = {
  jobId,
  generation: 1,
  baseVersionId: versionId,
  materialSetHash,
  addedMaterialCount: 1,
  totalMaterialCount: 1,
  queuedAt: at,
} satisfies PendingJobMarker;

const spaceRecord = {
  schemaVersion: 1,
  checksum: factChecksum,
  id: spaceId,
  displayName: "People",
  kind: "people",
} satisfies SpaceRecord;

const subjectRecord = {
  schemaVersion: 1,
  checksum: factChecksum,
  id: subjectId,
  spaceId,
  displayName: "Ada",
  aliases: ["A"],
  identityHints: [{ kind: "url", value: "https://example.com/ada" }],
  domainPack: "creator",
  lifecycle: "active",
} satisfies SubjectRecord;

const subjectStateRecord = {
  schemaVersion: 1,
  checksum: factChecksum,
  subjectId,
  generation: 1,
  materialSetHash,
  materialManifest: [firstEntry],
  currentVersionId: versionId,
  pending: pendingMarker,
} satisfies SubjectStateRecord;

const eventRecord = {
  schemaVersion: 1,
  checksum: factChecksum,
  eventId,
  event: { kind: "material.ingested", subjectId, at },
  actor,
  requestId,
} satisfies EventRecord;

const jobChangedEvent = {
  ...eventRecord,
  eventId: eventIdSchema.parse(`event_${ALT_HEX_32}`),
  event: { kind: "job.changed", subjectId, at },
} satisfies EventRecord;

const subjectCreatedEvent = {
  ...eventRecord,
  eventId: eventIdSchema.parse(`event_${THIRD_HEX_32}`),
  event: { kind: "subject.created", subjectId, at },
} satisfies EventRecord;

const versionRecord = {
  schemaVersion: 1,
  checksum: factChecksum,
  id: versionId,
  subjectId,
  generation: 1,
  materialSetHash,
  materialCount: 1,
  creation: currentVersion.creation,
  createdDisposition: "current",
  actor,
  quality,
  rendererVersion: "renderer-v1",
  createdAt: at,
} satisfies VersionRecord;

const versionManifest = {
  schemaVersion: 1,
  checksum: factChecksum,
  items: [firstEntry],
} satisfies VersionMaterialManifest;

const preparedTransaction = {
  schemaVersion: 1,
  checksum: factChecksum,
  transactionKind: "ingest",
  requestId,
  subjectId,
  createdSubject: false,
  previousStateChecksum: otherFactChecksum,
  targetStateChecksum: factChecksum,
  newMaterials: [firstEntry],
  operation: operationRecords["materials.ingest"],
  events: [eventRecord, jobChangedEvent],
  preparedAt: at,
  state: "prepared",
} satisfies IngestTransactionRecord;

const createTransaction = {
  schemaVersion: 1,
  checksum: factChecksum,
  transactionKind: "ingest",
  requestId,
  subjectId,
  createdSubject: true,
  targetStateChecksum: factChecksum,
  newMaterials: [firstEntry],
  operation: {
    ...operationRecords["materials.ingest"],
    result: { ...ingestResult, created: true },
  },
  events: [subjectCreatedEvent, eventRecord, jobChangedEvent],
  preparedAt: at,
  state: "prepared",
} satisfies IngestTransactionRecord;

const parseRoundTrip = (schema: { parse(value: unknown): unknown }, fixture: unknown): unknown => {
  const parsed = schema.parse(fixture);
  const serialized = JSON.stringify(parsed);
  expect(serialized).toBeDefined();
  const fromJson: unknown = JSON.parse(serialized ?? "null");
  expect(schema.parse(fromJson)).toEqual(parsed);
  return parsed;
};

const makeEntry = (index: number): VersionMaterialEntry => {
  const suffix = index.toString(16).padStart(64, "0");
  return {
    materialId: materialIdSchema.parse(`mat_${suffix}`),
    contentDigest: contentDigestSchema.parse(`sha256_${suffix}`),
    provenanceDigest: provenanceDigestSchema.parse(`provenance_sha256_${suffix}`),
  };
};

describe("persisted fact runtime schemas", () => {
  it("keeps every mutation result correlated with its method at compile time", () => {
    type StoredResults = {
      readonly [M in MutationMethodName]: OperationRecord<M>["result"];
    };
    type DeclaredResults = {
      readonly [M in MutationMethodName]: EngineMethodMap[M]["result"];
    };

    expectTypeOf<StoredResults>().toEqualTypeOf<DeclaredResults>();
    expectTypeOf<keyof typeof operationRecords>().toEqualTypeOf<MutationMethodName>();
  });

  it.each(mutationMethods)("round-trips a method-correlated %s operation", (method) => {
    parseRoundTrip(operationRecordSchema, operationRecords[method]);
  });

  it.each(mutationMethods)("rejects a result from another result shape for %s", (method) => {
    expect(() =>
      operationRecordSchema.parse({
        ...operationRecords[method],
        result: wrongResults[method],
      }),
    ).toThrow();
  });

  it("round-trips every fact record and transaction branch as JSON", () => {
    const fixtures = [
      [factEnvelopeSchema, { schemaVersion: 1, checksum: factChecksum }],
      [spaceRecordSchema, spaceRecord],
      [subjectRecordSchema, subjectRecord],
      [versionMaterialEntrySchema, firstEntry],
      [pendingJobMarkerSchema, pendingMarker],
      [subjectStateRecordSchema, subjectStateRecord],
      [eventRecordSchema, eventRecord],
      [versionRecordSchema, versionRecord],
      [versionMaterialManifestSchema, versionManifest],
      [ingestTransactionRecordSchema, preparedTransaction],
      [ingestTransactionRecordSchema, createTransaction],
      [ingestTransactionRecordSchema, { ...preparedTransaction, state: "committed", finishedAt }],
      [ingestTransactionRecordSchema, { ...preparedTransaction, state: "aborted", finishedAt }],
    ] as const;

    for (const [schema, fixture] of fixtures) parseRoundTrip(schema, fixture);
  });

  it("rejects unknown keys and unknown discriminants", () => {
    expect(() => spaceRecordSchema.parse({ ...spaceRecord, unexpected: true })).toThrow();
    expect(() =>
      subjectRecordSchema.parse({
        ...subjectRecord,
        identityHints: [{ kind: "url", value: "https://example.com", unexpected: true }],
      }),
    ).toThrow();
    expect(() =>
      operationRecordSchema.parse({ ...operationBase, method: "future", result: null }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({ ...preparedTransaction, state: "future" }),
    ).toThrow();
    expect(() =>
      versionRecordSchema.parse({
        ...versionRecord,
        creation: { kind: "future" },
      }),
    ).toThrow();
  });

  it("enforces safe integers, string limits, and bounded ingest arrays", () => {
    expect(() =>
      subjectStateRecordSchema.parse({
        ...subjectStateRecord,
        generation: Number.MAX_SAFE_INTEGER + 1,
      }),
    ).toThrow();
    expect(() => versionRecordSchema.parse({ ...versionRecord, materialCount: -1 })).toThrow();
    expect(() =>
      pendingJobMarkerSchema.parse({ ...pendingMarker, addedMaterialCount: 2 }),
    ).toThrow();
    expect(() => spaceRecordSchema.parse({ ...spaceRecord, displayName: "" })).toThrow();
    expect(() =>
      subjectRecordSchema.parse({
        ...subjectRecord,
        aliases: Array.from({ length: WIRE_LIMITS.smallArrayItems + 1 }, () => "alias"),
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        newMaterials: Array.from({ length: WIRE_LIMITS.ingestMaterials + 1 }, (_, index) =>
          makeEntry(index),
        ),
      }),
    ).toThrow();
  });

  it("accepts large sorted manifests without imposing a wire-list cap", () => {
    const items = Array.from({ length: WIRE_LIMITS.smallArrayItems + 1 }, (_, index) =>
      makeEntry(index),
    );
    expect(() => versionMaterialManifestSchema.parse({ ...versionManifest, items })).not.toThrow();
  });

  it("requires strictly sorted, duplicate-free material manifests", () => {
    expect(() =>
      versionMaterialManifestSchema.parse({
        ...versionManifest,
        items: [secondEntry, firstEntry],
      }),
    ).toThrow();
    expect(() =>
      subjectStateRecordSchema.parse({
        ...subjectStateRecord,
        materialManifest: [firstEntry, firstEntry],
        pending: { ...pendingMarker, totalMaterialCount: 2 },
      }),
    ).toThrow();
  });

  it("enforces empty and non-empty subject state invariants", () => {
    expect(() =>
      subjectStateRecordSchema.parse({
        schemaVersion: 1,
        checksum: factChecksum,
        subjectId,
        generation: 0,
        materialManifest: [],
      }),
    ).not.toThrow();
    expect(() =>
      subjectStateRecordSchema.parse({
        ...subjectStateRecord,
        generation: 0,
      }),
    ).toThrow();
    expect(() =>
      subjectStateRecordSchema.parse({
        ...subjectStateRecord,
        materialSetHash: undefined,
      }),
    ).toThrow();
    expect(() =>
      subjectStateRecordSchema.parse({
        ...subjectStateRecord,
        pending: { ...pendingMarker, generation: 2 },
      }),
    ).toThrow();
    expect(() =>
      subjectStateRecordSchema.parse({
        ...subjectStateRecord,
        materialManifest: [],
      }),
    ).toThrow();
  });

  it("limits requestless durable events to system recovery", () => {
    expect(() => eventRecordSchema.parse({ ...eventRecord, requestId: undefined })).toThrow();
    expect(() =>
      eventRecordSchema.parse({
        ...eventRecord,
        actor: { kind: "system", id: "recovery" },
        requestId: undefined,
      }),
    ).not.toThrow();
  });

  it("enforces ingest transaction branch and correlation invariants", () => {
    expect(() =>
      ingestTransactionRecordSchema.parse({ ...preparedTransaction, finishedAt }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        state: "committed",
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        previousStateChecksum: undefined,
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        operation: {
          ...preparedTransaction.operation,
          result: { ...preparedTransaction.operation.result, created: true },
        },
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        operation: { ...preparedTransaction.operation, requestId: otherRequestId },
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        operation: {
          ...preparedTransaction.operation,
          result: {
            ...preparedTransaction.operation.result,
            subject: { ...subject, id: otherSubjectId },
          },
        },
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        operation: {
          ...preparedTransaction.operation,
          result: {
            ...preparedTransaction.operation.result,
            job: { ...pendingJob, subjectId: otherSubjectId },
          },
        },
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        newMaterials: [secondEntry],
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        events: [eventRecord],
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        events: [jobChangedEvent, eventRecord],
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        events: [eventRecord, { ...jobChangedEvent, eventId }],
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        events: [
          { ...eventRecord, event: { ...eventRecord.event, subjectId: otherSubjectId } },
          jobChangedEvent,
        ],
      }),
    ).toThrow();

    const unchangedOperation = {
      ...preparedTransaction.operation,
      result: {
        kind: "unchanged",
        subject,
        items: [{ ...ingestItem, kind: "duplicate" }],
        materialSetHash,
        generation: 1,
        job: pendingJob,
      },
    } as const;
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        newMaterials: [],
        operation: unchangedOperation,
        events: [],
      }),
    ).not.toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        newMaterials: [],
        operation: unchangedOperation,
        events: [jobChangedEvent],
      }),
    ).not.toThrow();
  });
});
