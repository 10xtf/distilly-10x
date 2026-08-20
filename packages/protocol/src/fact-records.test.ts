import { describe, expect, expectTypeOf, it } from "vitest";

import { WIRE_LIMITS } from "./json.js";
import type { EngineMethodMap, MutationMethodName } from "./methods.js";
import {
  distillCommitTransactionRecordSchema,
  distillLeaseTransactionMethodSchema,
  distillLeaseTransactionRecordSchema,
  eventRecordSchema,
  factEnvelopeSchema,
  ingestTransactionRecordSchema,
  operationFactSchema,
  operationRecordSchema,
  operationScopeSchema,
  operationTombstoneRecordSchema,
  pendingLeaseMarkerSchema,
  pendingJobMarkerSchema,
  spaceRecordSchema,
  subjectRecordSchema,
  subjectStateRecordSchema,
  transactionRecordSchema,
  versionClaimsSnapshotSchema,
  versionMaterialEntrySchema,
  versionMaterialManifestSchema,
  versionRecordSchema,
} from "./schemas/facts.js";
import {
  briefContractDigestSchema,
  claimIdSchema,
  contentDigestSchema,
  eventIdSchema,
  facetPathSchema,
  factChecksumSchema,
  hostNameSchema,
  isoDateTimeSchema,
  jobIdSchema,
  leaseIdSchema,
  leaseOwnerIdSchema,
  materialIdSchema,
  materialSetHashSchema,
  provenanceDigestSchema,
  requestIdSchema,
  spaceIdSchema,
  subjectIdSchema,
  versionIdSchema,
} from "./schemas/ids.js";
import type {
  DistillCommitTransactionRecord,
  DistillLeaseTransactionMethod,
  DistillLeaseTransactionRecord,
  EventRecord,
  IngestTransactionRecord,
  OperationFact,
  OperationRecord,
  OperationScope,
  OperationTombstoneRecord,
  PendingLeaseMarker,
  PendingJobMarker,
  SpaceRecord,
  SubjectRecord,
  SubjectStateRecord,
  TransactionRecord,
  VersionClaimsSnapshot,
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
const otherSpaceId = spaceIdSchema.parse(`space_${ALT_HEX_32}`);
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
const promptVersion = `host-distill-v1-sha256_${HEX_64}` as const;
const leaseOwnerId = leaseOwnerIdSchema.parse(`lease_owner_${HEX_32}`);
const claimId = claimIdSchema.parse(`claim_${HEX_64}`);
const secondClaimId = claimIdSchema.parse(`claim_${ALT_HEX_64}`);
const identityFacet = facetPathSchema.parse("identity");
const host = hostNameSchema.parse("codex");
const at = isoDateTimeSchema.parse("2026-08-20T00:00:00.000Z");
const finishedAt = isoDateTimeSchema.parse("2026-08-20T00:01:00.000Z");
const renewedExpiresAt = isoDateTimeSchema.parse("2026-08-20T00:02:00.000Z");

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
    promptVersion,
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
  displayName: "Ada",
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

const leasedJob = {
  ...pendingJob,
  state: "leased",
  leaseExpiresAt: finishedAt,
} as const;

const lease = {
  id: leaseId,
  jobId,
  generation: 1,
  briefContractDigest,
  owner: leaseOwnerId,
  acquiredAt: at,
  expiresAt: finishedAt,
} as const;

const renewedLease = {
  ...lease,
  expiresAt: renewedExpiresAt,
} as const;

const briefContract = {
  digest: briefContractDigest,
  sourceGroupingVersion: "source-groups-v1",
  promptVersion,
  draftSchemaVersion: 1,
} as const;

const briefing = {
  job: leasedJob,
  lease,
  subject,
  baseline: {
    versionId,
    claims: [],
    quality,
    evidenceFacts: [],
  },
  materials: [],
  contract: {
    ...briefContract,
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

const methodsWithVisibleSubjectResults = [
  "subjects.create",
  "materials.ingest",
  "materials.ingestFiles",
  "distill.brief",
  "distill.commit",
  "distill.redistill",
  "profiles.correct",
  "versions.promote",
  "versions.reject",
  "versions.rollback",
  "hosts.install",
  "hosts.export",
  "bundles.import",
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
  recordKind: "completed",
  requestId,
  scope: { kind: "subject", subjectId },
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
    scope: { kind: "global" },
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

const operationTombstone = {
  schemaVersion: 1,
  checksum: factChecksum,
  recordKind: "tombstone",
  requestId,
  method: "subjects.purge",
  scope: { kind: "subject", subjectId },
  inputChecksum: otherFactChecksum,
  removedAt: finishedAt,
  reason: "subject_purged",
} satisfies OperationTombstoneRecord;

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

const firstClaim = {
  id: claimId,
  facet: identityFacet,
  text: "Ada writes.",
  evidence: [{ materialId, quote: "Ada writes." }],
  status: "active",
  strength: "single_source",
  observedIn: ["2026"],
  createdIn: versionId,
} as const;

const secondClaim = {
  ...firstClaim,
  id: secondClaimId,
  text: "Ada publishes.",
} as const;

const versionClaimsSnapshot = {
  schemaVersion: 1,
  checksum: factChecksum,
  subjectId,
  versionId,
  claims: [firstClaim, secondClaim],
} satisfies VersionClaimsSnapshot;

const pendingLeaseMarker = {
  id: leaseId,
  owner: leaseOwnerId,
  acquiredAt: at,
  expiresAt: finishedAt,
  contract: briefContract,
} satisfies PendingLeaseMarker;

const pendingMarker = {
  jobId,
  generation: 1,
  baseVersionId: versionId,
  materialSetHash,
  addedMaterialCount: 1,
  totalMaterialCount: 1,
  queuedAt: at,
} satisfies PendingJobMarker;

const leasedPendingMarker = {
  ...pendingMarker,
  lease: pendingLeaseMarker,
} satisfies PendingJobMarker;

const renewedPendingMarker = {
  ...pendingMarker,
  lease: { ...pendingLeaseMarker, expiresAt: renewedExpiresAt },
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
  schemaVersion: 2,
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
  subjectDisplayName: "Ada",
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
  spaceId,
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
  spaceId,
  subjectId,
  createdSubject: true,
  targetSubjectChecksum: otherFactChecksum,
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

const preparedBriefTransaction = {
  schemaVersion: 1,
  checksum: factChecksum,
  transactionKind: "distill_lease",
  method: "brief",
  requestId,
  subjectId,
  jobId,
  previousStateChecksum: otherFactChecksum,
  targetStateChecksum: factChecksum,
  previousPending: pendingMarker,
  targetPending: leasedPendingMarker,
  operation: operationRecords["distill.brief"],
  event: jobChangedEvent,
  preparedAt: at,
  state: "prepared",
} satisfies DistillLeaseTransactionRecord;

const preparedRenewTransaction = {
  ...preparedBriefTransaction,
  method: "renew",
  previousPending: leasedPendingMarker,
  targetPending: renewedPendingMarker,
  operation: {
    ...operationRecords["distill.renew"],
    result: renewedLease,
  },
} satisfies DistillLeaseTransactionRecord;

const preparedReleaseTransaction = {
  ...preparedBriefTransaction,
  method: "release",
  previousPending: leasedPendingMarker,
  targetPending: pendingMarker,
  operation: operationRecords["distill.release"],
} satisfies DistillLeaseTransactionRecord;

const commitVersion = {
  ...currentVersion,
  id: candidateVersionId,
  parentId: versionId,
} as const;

const commitProfile = {
  ...profile,
  versionId: candidateVersionId,
} as const;

const commitVersionRecord = {
  ...versionRecord,
  id: candidateVersionId,
  parentId: versionId,
  rendererVersion: "profile-renderer-v1",
} satisfies VersionRecord;

const commitClaimsSnapshot = {
  schemaVersion: 1,
  checksum: factChecksum,
  subjectId,
  versionId: candidateVersionId,
  claims: [],
} satisfies VersionClaimsSnapshot;

const commitTargetState = {
  schemaVersion: 2,
  checksum: otherFactChecksum,
  subjectId,
  generation: 1,
  materialSetHash,
  materialManifest: [firstEntry],
  currentVersionId: candidateVersionId,
} satisfies SubjectStateRecord;

const versionCurrentEvent = {
  ...eventRecord,
  eventId: eventIdSchema.parse(`event_${THIRD_HEX_32}`),
  event: { kind: "version.current", subjectId, versionId: candidateVersionId, at },
} satisfies EventRecord;

const commitOperation = {
  ...operationRecords["distill.commit"],
  result: {
    kind: "current",
    version: commitVersion,
    profile: commitProfile,
  },
} satisfies OperationRecord<"distill.commit">;

const preparedCommitTransaction = {
  schemaVersion: 1,
  checksum: factChecksum,
  transactionKind: "distill_commit",
  requestId,
  subjectId,
  jobId,
  leaseId,
  leaseOwner: leaseOwnerId,
  previousStateChecksum: otherFactChecksum,
  previousPending: leasedPendingMarker,
  targetState: commitTargetState,
  acceptedPatch: { operations: [] },
  patchDigest: contentDigest,
  version: commitVersionRecord,
  materialManifest: versionManifest,
  claims: commitClaimsSnapshot,
  profile: commitProfile,
  prompt: "# Distilly simulation context\n",
  operation: commitOperation,
  events: [versionCurrentEvent, jobChangedEvent],
  preparedAt: at,
  state: "prepared",
} satisfies DistillCommitTransactionRecord;

const reviewReasons = [{ code: "manual_review_requested", note: "Review identity." }] as const;

const suspendedCommitVersionRecord = {
  ...commitVersionRecord,
  createdDisposition: "suspended",
  reviewReasons,
} satisfies VersionRecord;

const versionSuspendedEvent = {
  ...versionCurrentEvent,
  event: { kind: "version.suspended", subjectId, versionId: candidateVersionId, at },
} satisfies EventRecord;

const suspendedCommitOperation = {
  ...commitOperation,
  result: {
    kind: "suspended",
    candidate: { ...commitVersion, status: "suspended" },
    currentVersionId: versionId,
    reasons: reviewReasons,
    review: { subjectId, candidateVersionId },
  },
} satisfies OperationRecord<"distill.commit">;

const preparedSuspendedCommitTransaction = {
  ...preparedCommitTransaction,
  targetState: {
    ...commitTargetState,
    currentVersionId: versionId,
    suspendedVersionId: candidateVersionId,
  },
  version: suspendedCommitVersionRecord,
  operation: suspendedCommitOperation,
  events: [versionSuspendedEvent, jobChangedEvent],
} satisfies DistillCommitTransactionRecord;

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
    expectTypeOf<OperationFact>().toEqualTypeOf<OperationRecord | OperationTombstoneRecord>();
    expectTypeOf<TransactionRecord>().toEqualTypeOf<
      IngestTransactionRecord | DistillLeaseTransactionRecord | DistillCommitTransactionRecord
    >();
    expectTypeOf<DistillLeaseTransactionMethod>().toEqualTypeOf<"brief" | "renew" | "release">();
    expect(distillLeaseTransactionMethodSchema.parse("brief")).toBe("brief");
    expect(() => distillLeaseTransactionMethodSchema.parse("distill.brief")).toThrow();
    expectTypeOf<OperationScope>().toEqualTypeOf<
      | { readonly kind: "global" }
      | { readonly kind: "subject"; readonly subjectId: typeof subjectId }
    >();
  });

  it.each(mutationMethods)("round-trips a method-correlated %s operation", (method) => {
    parseRoundTrip(operationRecordSchema, operationRecords[method]);
    parseRoundTrip(operationFactSchema, operationRecords[method]);
  });

  it.each(mutationMethods)("rejects a result from another result shape for %s", (method) => {
    expect(() =>
      operationRecordSchema.parse({
        ...operationRecords[method],
        result: wrongResults[method],
      }),
    ).toThrow();
  });

  it("enforces operation scopes and visible result subjects", () => {
    expect(operationScopeSchema.parse({ kind: "global" })).toEqual({ kind: "global" });
    expect(operationScopeSchema.parse({ kind: "subject", subjectId })).toEqual({
      kind: "subject",
      subjectId,
    });
    expect(() => operationScopeSchema.parse({ kind: "global", subjectId })).toThrow();
    expect(() => operationScopeSchema.parse({ kind: "subject" })).toThrow();

    expect(() =>
      operationRecordSchema.parse({
        ...operationRecords["library.rebuild"],
        scope: { kind: "subject", subjectId },
      }),
    ).toThrow();
    expect(() =>
      operationRecordSchema.parse({
        ...operationRecords["subjects.archive"],
        scope: { kind: "global" },
      }),
    ).toThrow();
  });

  it.each(methodsWithVisibleSubjectResults)(
    "rejects a %s result outside its subject scope",
    (method) => {
      expect(() =>
        operationRecordSchema.parse({
          ...operationRecords[method],
          scope: { kind: "subject", subjectId: otherSubjectId },
        }),
      ).toThrow();
    },
  );

  it("round-trips a content-free operation tombstone and enforces its scope", () => {
    parseRoundTrip(operationTombstoneRecordSchema, operationTombstone);
    parseRoundTrip(operationFactSchema, operationTombstone);
    expect(() => operationTombstoneRecordSchema.parse({ ...operationTombstone, actor })).toThrow();
    expect(() =>
      operationTombstoneRecordSchema.parse({ ...operationTombstone, result: null }),
    ).toThrow();
    expect(() =>
      operationTombstoneRecordSchema.parse({
        ...operationTombstone,
        scope: { kind: "global" },
      }),
    ).toThrow();
    expect(() =>
      operationTombstoneRecordSchema.parse({
        ...operationTombstone,
        method: "library.rebuild",
        scope: { kind: "global" },
      }),
    ).not.toThrow();
  });

  it("round-trips every fact record and transaction branch as JSON", () => {
    const fixtures = [
      [factEnvelopeSchema, { schemaVersion: 1, checksum: factChecksum }],
      [spaceRecordSchema, spaceRecord],
      [subjectRecordSchema, subjectRecord],
      [versionMaterialEntrySchema, firstEntry],
      [versionClaimsSnapshotSchema, versionClaimsSnapshot],
      [pendingLeaseMarkerSchema, pendingLeaseMarker],
      [pendingJobMarkerSchema, pendingMarker],
      [pendingJobMarkerSchema, leasedPendingMarker],
      [subjectStateRecordSchema, subjectStateRecord],
      [eventRecordSchema, eventRecord],
      [operationTombstoneRecordSchema, operationTombstone],
      [versionRecordSchema, versionRecord],
      [versionMaterialManifestSchema, versionManifest],
      [ingestTransactionRecordSchema, preparedTransaction],
      [ingestTransactionRecordSchema, createTransaction],
      [ingestTransactionRecordSchema, { ...preparedTransaction, state: "committed", finishedAt }],
      [ingestTransactionRecordSchema, { ...preparedTransaction, state: "aborted", finishedAt }],
      [transactionRecordSchema, preparedTransaction],
      [distillLeaseTransactionRecordSchema, preparedBriefTransaction],
      [distillLeaseTransactionRecordSchema, preparedRenewTransaction],
      [distillLeaseTransactionRecordSchema, preparedReleaseTransaction],
      [
        distillLeaseTransactionRecordSchema,
        { ...preparedBriefTransaction, state: "committed", finishedAt },
      ],
      [
        distillLeaseTransactionRecordSchema,
        { ...preparedRenewTransaction, state: "committed", finishedAt },
      ],
      [
        distillLeaseTransactionRecordSchema,
        { ...preparedReleaseTransaction, state: "committed", finishedAt },
      ],
      [
        distillLeaseTransactionRecordSchema,
        { ...preparedBriefTransaction, state: "aborted", finishedAt },
      ],
      [
        distillLeaseTransactionRecordSchema,
        { ...preparedRenewTransaction, state: "aborted", finishedAt },
      ],
      [
        distillLeaseTransactionRecordSchema,
        { ...preparedReleaseTransaction, state: "aborted", finishedAt },
      ],
      [transactionRecordSchema, preparedBriefTransaction],
      [distillCommitTransactionRecordSchema, preparedCommitTransaction],
      [distillCommitTransactionRecordSchema, preparedSuspendedCommitTransaction],
      [
        distillCommitTransactionRecordSchema,
        { ...preparedCommitTransaction, state: "committed", finishedAt },
      ],
      [
        distillCommitTransactionRecordSchema,
        { ...preparedCommitTransaction, state: "aborted", finishedAt },
      ],
      [transactionRecordSchema, preparedCommitTransaction],
      [transactionRecordSchema, preparedSuspendedCommitTransaction],
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
      operationFactSchema.parse({ ...operationTombstone, recordKind: "future" }),
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

  it("correlates version disposition with persisted review reasons", () => {
    expect(() => versionRecordSchema.parse(versionRecord)).not.toThrow();
    expect(() => versionRecordSchema.parse(suspendedCommitVersionRecord)).not.toThrow();
    expect(() => versionRecordSchema.parse({ ...versionRecord, reviewReasons })).toThrow();
    expect(() =>
      versionRecordSchema.parse({
        ...suspendedCommitVersionRecord,
        reviewReasons: undefined,
      }),
    ).toThrow();
  });

  it("enforces distill commit lifecycle and complete cross-record correlations", () => {
    const otherLeaseId = leaseIdSchema.parse(`lease_${ALT_HEX_32}`);
    const otherLeaseOwner = leaseOwnerIdSchema.parse(`lease_owner_${ALT_HEX_32}`);
    const invalidTransactions: readonly unknown[] = [
      { ...preparedCommitTransaction, finishedAt },
      { ...preparedCommitTransaction, state: "committed" },
      {
        ...preparedCommitTransaction,
        preparedAt: finishedAt,
        state: "committed",
        finishedAt: at,
      },
      { ...preparedCommitTransaction, leaseId: otherLeaseId },
      { ...preparedCommitTransaction, leaseOwner: otherLeaseOwner },
      {
        ...preparedCommitTransaction,
        previousPending: { ...leasedPendingMarker, lease: undefined },
      },
      {
        ...preparedCommitTransaction,
        previousPending: {
          ...leasedPendingMarker,
          jobId: jobIdSchema.parse(`job_${ALT_HEX_32}`),
        },
      },
      {
        ...preparedCommitTransaction,
        targetState: { ...commitTargetState, pending: leasedPendingMarker },
      },
      {
        ...preparedCommitTransaction,
        targetState: { ...commitTargetState, subjectId: otherSubjectId },
      },
      {
        ...preparedCommitTransaction,
        targetState: { ...commitTargetState, generation: 2 },
      },
      {
        ...preparedCommitTransaction,
        targetState: {
          ...commitTargetState,
          materialManifest: [firstEntry, secondEntry],
        },
      },
      {
        ...preparedCommitTransaction,
        targetState: { ...commitTargetState, currentVersionId: versionId },
      },
      {
        ...preparedCommitTransaction,
        version: { ...commitVersionRecord, subjectId: otherSubjectId },
      },
      {
        ...preparedCommitTransaction,
        version: { ...commitVersionRecord, parentId: candidateVersionId },
      },
      {
        ...preparedCommitTransaction,
        version: { ...commitVersionRecord, generation: 2 },
      },
      {
        ...preparedCommitTransaction,
        version: {
          ...commitVersionRecord,
          creation: { ...commitVersionRecord.creation, promptVersion: "other-prompt" },
        },
      },
      {
        ...preparedCommitTransaction,
        version: { ...commitVersionRecord, materialCount: 2 },
      },
      {
        ...preparedCommitTransaction,
        claims: { ...commitClaimsSnapshot, versionId },
      },
      {
        ...preparedCommitTransaction,
        profile: { ...commitProfile, displayName: "Augusta" },
      },
      {
        ...preparedCommitTransaction,
        profile: { ...commitProfile, claims: [firstClaim] },
      },
      {
        ...preparedCommitTransaction,
        profile: {
          ...commitProfile,
          quality: { ...quality, activeClaimCount: 1 },
        },
      },
      { ...preparedCommitTransaction, prompt: "" },
      {
        ...preparedCommitTransaction,
        operation: { ...commitOperation, requestId: otherRequestId },
      },
      {
        ...preparedCommitTransaction,
        operation: { ...commitOperation, actor: { kind: "sdk", id: "other-sdk" } },
      },
      {
        ...preparedCommitTransaction,
        operation: {
          ...commitOperation,
          result: {
            ...commitOperation.result,
            version: { ...commitVersion, id: versionId },
          },
        },
      },
      {
        ...preparedCommitTransaction,
        events: [
          { ...versionCurrentEvent, event: { ...versionCurrentEvent.event, versionId } },
          jobChangedEvent,
        ],
      },
      {
        ...preparedCommitTransaction,
        events: [
          versionCurrentEvent,
          {
            ...jobChangedEvent,
            event: { ...jobChangedEvent.event, versionId: candidateVersionId },
          },
        ],
      },
      {
        ...preparedCommitTransaction,
        events: [versionCurrentEvent, { ...jobChangedEvent, eventId: versionCurrentEvent.eventId }],
      },
      {
        ...preparedCommitTransaction,
        events: [
          versionCurrentEvent,
          { ...jobChangedEvent, event: { ...jobChangedEvent.event, at: finishedAt } },
        ],
      },
      {
        ...preparedCommitTransaction,
        version: { ...commitVersionRecord, createdAt: finishedAt },
      },
      {
        ...preparedCommitTransaction,
        operation: { ...commitOperation, completedAt: finishedAt },
      },
      {
        ...preparedSuspendedCommitTransaction,
        operation: {
          ...suspendedCommitOperation,
          result: {
            ...suspendedCommitOperation.result,
            reasons: [{ code: "source_diversity_decreased" }],
          },
        },
      },
    ];

    for (const transaction of invalidTransactions) {
      expect(() => distillCommitTransactionRecordSchema.parse(transaction)).toThrow();
    }
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

  it("requires version claims to be strictly sorted and duplicate-free", () => {
    expect(() => versionClaimsSnapshotSchema.parse(versionClaimsSnapshot)).not.toThrow();
    expect(() =>
      versionClaimsSnapshotSchema.parse({
        ...versionClaimsSnapshot,
        claims: [secondClaim, firstClaim],
      }),
    ).toThrow();
    expect(() =>
      versionClaimsSnapshotSchema.parse({
        ...versionClaimsSnapshot,
        claims: [firstClaim, firstClaim],
      }),
    ).toThrow();
  });

  it("enforces empty and non-empty subject state invariants", () => {
    expect(() =>
      subjectStateRecordSchema.parse({
        schemaVersion: 2,
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
    expect(() =>
      subjectStateRecordSchema.parse({ ...subjectStateRecord, schemaVersion: 1 }),
    ).toThrow();
    expect(() =>
      subjectStateRecordSchema.parse({
        ...subjectStateRecord,
        pending: { ...pendingMarker, baseVersionId: candidateVersionId },
      }),
    ).toThrow();
    expect(() =>
      subjectStateRecordSchema.parse({
        ...subjectStateRecord,
        currentVersionId: undefined,
      }),
    ).toThrow();
    expect(() =>
      pendingLeaseMarkerSchema.parse({ ...pendingLeaseMarker, expiresAt: at }),
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

  it("enforces distill lease transaction lifecycle and common correlations", () => {
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({ ...preparedBriefTransaction, finishedAt }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        state: "committed",
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        preparedAt: finishedAt,
        state: "committed",
        finishedAt: at,
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        operation: { ...preparedBriefTransaction.operation, requestId: otherRequestId },
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        operation: {
          ...preparedBriefTransaction.operation,
          scope: { kind: "subject", subjectId: otherSubjectId },
        },
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        targetPending: { ...leasedPendingMarker, generation: 2 },
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        jobId: jobIdSchema.parse(`job_${ALT_HEX_32}`),
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        event: { ...jobChangedEvent, event: { kind: "material.ingested", subjectId, at } },
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        event: {
          ...jobChangedEvent,
          event: { ...jobChangedEvent.event, subjectId: otherSubjectId },
        },
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        event: { ...jobChangedEvent, requestId: otherRequestId },
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        event: { ...jobChangedEvent, actor: { kind: "sdk", id: "other-sdk" } },
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        event: {
          ...jobChangedEvent,
          event: { ...jobChangedEvent.event, versionId },
        },
      }),
    ).toThrow();
  });

  it("correlates brief acquisition with the complete target marker", () => {
    expect(() => distillLeaseTransactionRecordSchema.parse(preparedBriefTransaction)).not.toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        targetPending: pendingMarker,
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        targetPending: {
          ...leasedPendingMarker,
          lease: {
            ...pendingLeaseMarker,
            owner: leaseOwnerIdSchema.parse(`lease_owner_${ALT_HEX_32}`),
          },
        },
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        operation: {
          ...preparedBriefTransaction.operation,
          result: {
            ...preparedBriefTransaction.operation.result,
            subject: { ...subject, currentVersionId: candidateVersionId },
          },
        },
      }),
    ).toThrow();
  });

  it("allows renew to change only expiry and correlates its returned lease", () => {
    expect(() => distillLeaseTransactionRecordSchema.parse(preparedRenewTransaction)).not.toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedRenewTransaction,
        previousPending: pendingMarker,
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedRenewTransaction,
        targetPending: pendingMarker,
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedRenewTransaction,
        targetPending: {
          ...renewedPendingMarker,
          lease: { ...renewedPendingMarker.lease, acquiredAt: finishedAt },
        },
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedRenewTransaction,
        targetPending: leasedPendingMarker,
        operation: { ...preparedRenewTransaction.operation, result: lease },
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedRenewTransaction,
        operation: {
          ...preparedRenewTransaction.operation,
          result: { ...renewedLease, generation: 2 },
        },
      }),
    ).toThrow();
  });

  it("requires release to remove exactly one existing lease", () => {
    expect(() =>
      distillLeaseTransactionRecordSchema.parse(preparedReleaseTransaction),
    ).not.toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedReleaseTransaction,
        previousPending: pendingMarker,
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedReleaseTransaction,
        targetPending: leasedPendingMarker,
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedReleaseTransaction,
        method: "renew",
      }),
    ).toThrow();
    expect(() =>
      distillLeaseTransactionRecordSchema.parse({
        ...preparedBriefTransaction,
        method: "distill.brief",
      }),
    ).toThrow();
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
        targetSubjectChecksum: factChecksum,
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...createTransaction,
        targetSubjectChecksum: undefined,
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...createTransaction,
        previousStateChecksum: factChecksum,
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
          scope: { kind: "global" },
        },
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        operation: {
          ...preparedTransaction.operation,
          scope: { kind: "subject", subjectId: otherSubjectId },
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
            subject: { ...subject, id: otherSubjectId },
          },
        },
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        spaceId: otherSpaceId,
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        operation: {
          ...preparedTransaction.operation,
          result: {
            ...preparedTransaction.operation.result,
            subject: {
              ...subject,
              space: { ...subject.space, id: otherSpaceId },
            },
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
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        events: [{ ...eventRecord, actor: { kind: "sdk", id: "other-sdk" } }, jobChangedEvent],
      }),
    ).toThrow();
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        events: [{ ...eventRecord, requestId: otherRequestId }, jobChangedEvent],
      }),
    ).toThrow();

    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...preparedTransaction,
        targetStateChecksum: preparedTransaction.previousStateChecksum,
      }),
    ).not.toThrow();

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
    expect(() =>
      ingestTransactionRecordSchema.parse({
        ...createTransaction,
        operation: unchangedOperation,
        newMaterials: [],
        events: [],
      }),
    ).toThrow();
  });
});
