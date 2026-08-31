import { DistillyError, transactionRecordSchema } from "@distilly/protocol";
import type {
  Claim,
  CommitResult,
  DistillCommitTransactionRecord,
  DistillLeaseTransactionRecord,
  EngineEvent,
  EventId,
  EventRecord,
  IsoDateTime,
  OperationFact,
  PendingJob,
  PendingJobMarker,
  Profile,
  RequestId,
  ReviewDecisionTransactionRecord,
  RollbackTransactionRecord,
  SubjectRecord,
  SubjectId,
  SubjectStateRecord,
  SubjectSummary,
  TransactionRecord,
  VersionId,
  VersionRecord,
  VersionSummary,
} from "@distilly/protocol";

import type { Clock } from "../defaults/system-clock.js";
import { digestBriefContract, digestDistillPatch } from "../facts/digests.js";
import type { FileEventStore } from "../facts/event-store.js";
import type { FileCurrentProfileProjection } from "../facts/current-profile-projection.js";
import type { FileOperationStore } from "../facts/operation-store.js";
import { computeFactChecksum, verifyFactChecksum } from "../facts/checksum.js";
import { canonicalJson } from "../facts/canonical-json.js";
import type { FileStateStore } from "../facts/state-store.js";
import type { FileSubjectStore } from "../facts/subject-store.js";
import type { FileTransactionStore } from "./legacy-file-transaction-store.test.fixture.js";
import type { StoredCompleteVersion, VersionArtifactSet } from "../facts/version-store.js";
import { validateVersionArtifactSet } from "../facts/version-store.js";
import type { FileVersionStore } from "../facts/version-store.js";
import { storageCorrupt } from "../internal-errors.js";
import type { EventBus } from "../ports/event-bus.js";
import type { QueueRepository } from "./legacy-queue-repository.test.fixture.js";
import { validateRollbackHistoricalCopy } from "../read/committed-version-reader.js";
import type { FileRequestLock } from "../transaction/request-lock.js";
import type { FileSubjectLock } from "../transaction/subject-lock.js";
import type { FileVersionStaging } from "./legacy-file-version-staging.test.fixture.js";

/** Fault-injection hooks for idempotent post-commit recovery tests. */
export interface RecoveryHooks {
  /** Runs after the immutable completed operation is durable. */
  readonly afterOperation?: () => void | Promise<void>;
  /** Runs after one immutable event is durable. */
  readonly afterEvent?: (eventId: EventId) => void | Promise<void>;
  /** Runs after the queue projection is durable and clean. */
  readonly afterQueue?: () => void | Promise<void>;
  /** Runs after the disposable current profile has been rebuilt. */
  readonly afterCurrentProfile?: () => void | Promise<void>;
  /** Runs after the optional Library projection reports a durable clean or dirty state. */
  readonly afterLibrary?: () => void | Promise<void>;
  /** Runs after a commit journal has reached its durable terminal state. */
  readonly afterCommitTerminal?: () => void | Promise<void>;
  /** Runs after a review journal has reached its durable terminal state. */
  readonly afterReviewTerminal?: () => void | Promise<void>;
  /** Runs after a rollback journal has reached its durable terminal state. */
  readonly afterRollbackTerminal?: () => void | Promise<void>;
}

const optionalSubject = async (
  store: FileSubjectStore,
  subjectId: SubjectId,
): Promise<SubjectRecord | undefined> => {
  try {
    return await store.read(subjectId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") return undefined;
    throw error;
  }
};

const optionalState = async (
  store: FileStateStore,
  subjectId: SubjectId,
): Promise<SubjectStateRecord | undefined> => {
  try {
    return await store.read(subjectId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") return undefined;
    throw error;
  }
};

const optionalEvent = async (
  store: FileEventStore,
  subjectId: SubjectId,
  eventId: EventId,
): Promise<EventRecord | undefined> => {
  try {
    return await store.read(subjectId, eventId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") return undefined;
    throw error;
  }
};

const requiredVersion = async (
  store: FileVersionStore,
  subjectId: SubjectId,
  versionId: VersionId,
  message: string,
): Promise<StoredCompleteVersion> => {
  try {
    return await store.read(subjectId, versionId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") {
      throw storageCorrupt(message, error);
    }
    throw error;
  }
};

const terminalLeaseTransaction = (
  transaction: DistillLeaseTransactionRecord,
  state: "committed" | "aborted",
  finishedAt: IsoDateTime,
): DistillLeaseTransactionRecord => {
  const common = {
    schemaVersion: 1,
    transactionKind: "distill_lease",
    method: transaction.method,
    requestId: transaction.requestId,
    subjectId: transaction.subjectId,
    jobId: transaction.jobId,
    previousStateChecksum: transaction.previousStateChecksum,
    targetStateChecksum: transaction.targetStateChecksum,
    previousPending: transaction.previousPending,
    targetPending: transaction.targetPending,
    operation: transaction.operation,
    event: transaction.event,
    preparedAt: transaction.preparedAt,
    finishedAt,
  } as const;
  const payload = { ...common, state };
  return transactionRecordSchema.parse({
    ...payload,
    checksum: computeFactChecksum(payload),
  }) as DistillLeaseTransactionRecord;
};

const terminalCommitTransaction = (
  transaction: DistillCommitTransactionRecord,
  state: "committed" | "aborted",
  finishedAt: IsoDateTime,
): DistillCommitTransactionRecord => {
  const payload = {
    schemaVersion: 1,
    transactionKind: "distill_commit",
    requestId: transaction.requestId,
    subjectId: transaction.subjectId,
    jobId: transaction.jobId,
    leaseId: transaction.leaseId,
    leaseOwner: transaction.leaseOwner,
    previousStateChecksum: transaction.previousStateChecksum,
    previousPending: transaction.previousPending,
    targetState: transaction.targetState,
    acceptedPatch: transaction.acceptedPatch,
    patchDigest: transaction.patchDigest,
    version: transaction.version,
    materialManifest: transaction.materialManifest,
    claims: transaction.claims,
    profile: transaction.profile,
    prompt: transaction.prompt,
    operation: transaction.operation,
    events: transaction.events,
    preparedAt: transaction.preparedAt,
    finishedAt,
    state,
  } as const;
  return transactionRecordSchema.parse({
    ...payload,
    checksum: computeFactChecksum(payload),
  }) as DistillCommitTransactionRecord;
};

const terminalReviewTransaction = (
  transaction: ReviewDecisionTransactionRecord,
  state: "committed" | "aborted",
  finishedAt: IsoDateTime,
): ReviewDecisionTransactionRecord => {
  const payload = {
    schemaVersion: 1,
    transactionKind: "review_decision",
    method: transaction.method,
    requestId: transaction.requestId,
    subjectId: transaction.subjectId,
    candidateVersionId: transaction.candidateVersionId,
    previousStateChecksum: transaction.previousStateChecksum,
    ...(transaction.previousCurrentVersionId === undefined
      ? {}
      : { previousCurrentVersionId: transaction.previousCurrentVersionId }),
    previousSuspendedVersionId: transaction.previousSuspendedVersionId,
    ...(transaction.previousPending === undefined
      ? {}
      : { previousPending: transaction.previousPending }),
    targetState: transaction.targetState,
    operation: transaction.operation,
    events: transaction.events,
    preparedAt: transaction.preparedAt,
    finishedAt,
    state,
  } as const;
  return transactionRecordSchema.parse({
    ...payload,
    checksum: computeFactChecksum(payload),
  }) as ReviewDecisionTransactionRecord;
};

const terminalRollbackTransaction = (
  transaction: RollbackTransactionRecord,
  state: "committed" | "aborted",
  finishedAt: IsoDateTime,
): RollbackTransactionRecord => {
  const payload = {
    schemaVersion: 1,
    transactionKind: "rollback",
    requestId: transaction.requestId,
    subjectId: transaction.subjectId,
    targetVersionId: transaction.targetVersionId,
    previousStateChecksum: transaction.previousStateChecksum,
    previousCurrentVersionId: transaction.previousCurrentVersionId,
    ...(transaction.previousPending === undefined
      ? {}
      : { previousPending: transaction.previousPending }),
    targetState: transaction.targetState,
    version: transaction.version,
    materialManifest: transaction.materialManifest,
    claims: transaction.claims,
    profile: transaction.profile,
    prompt: transaction.prompt,
    operation: transaction.operation,
    events: transaction.events,
    preparedAt: transaction.preparedAt,
    finishedAt,
    state,
  } as const;
  return transactionRecordSchema.parse({
    ...payload,
    checksum: computeFactChecksum(payload),
  }) as RollbackTransactionRecord;
};

const statePayloadWithPending = (
  state: SubjectStateRecord,
  pending: PendingJobMarker,
): Readonly<Record<string, unknown>> => ({
  schemaVersion: 2,
  subjectId: state.subjectId,
  generation: state.generation,
  ...(state.materialSetHash === undefined ? {} : { materialSetHash: state.materialSetHash }),
  materialManifest: state.materialManifest,
  ...(state.currentVersionId === undefined ? {} : { currentVersionId: state.currentVersionId }),
  ...(state.suspendedVersionId === undefined
    ? {}
    : { suspendedVersionId: state.suspendedVersionId }),
  pending,
});

const samePending = (left: PendingJobMarker, right: PendingJobMarker): boolean =>
  canonicalJson(left) === canonicalJson(right);

const samePendingFacts = (
  left: PendingJobMarker | undefined,
  right: PendingJobMarker | undefined,
): boolean =>
  left === undefined || right === undefined
    ? left === right
    : canonicalJson(left) === canonicalJson(right);

const pendingReferencesVersion = (
  pending: PendingJob | PendingJobMarker,
  versionId: VersionId,
): boolean => pending.baseVersionId === versionId;

const subjectReferencesVersion = (subject: SubjectSummary, versionId: VersionId): boolean =>
  subject.currentVersionId === versionId;

const claimsReferenceVersion = (claims: readonly Claim[], versionId: VersionId): boolean =>
  claims.some((claim) => claim.createdIn === versionId);

const creationReferencesVersion = (
  creation: VersionRecord["creation"],
  versionId: VersionId,
): boolean => {
  switch (creation.kind) {
    case "host_distill":
    case "correction":
    case "bundle_import":
      return false;
    case "rollback":
      return creation.targetVersionId === versionId;
    case "renderer_only":
      return creation.sourceVersionId === versionId;
    default: {
      const exhaustive: never = creation;
      return exhaustive;
    }
  }
};

const versionReferencesVersion = (
  version: VersionRecord | VersionSummary,
  versionId: VersionId,
): boolean =>
  version.id === versionId ||
  version.parentId === versionId ||
  version.derivedFromCandidateVersionId === versionId ||
  creationReferencesVersion(version.creation, versionId);

const profileReferencesVersion = (profile: Profile, versionId: VersionId): boolean =>
  profile.versionId === versionId || claimsReferenceVersion(profile.claims, versionId);

const stateReferencesVersion = (state: SubjectStateRecord, versionId: VersionId): boolean =>
  state.currentVersionId === versionId ||
  state.suspendedVersionId === versionId ||
  (state.pending !== undefined && pendingReferencesVersion(state.pending, versionId));

const commitResultReferencesVersion = (result: CommitResult, versionId: VersionId): boolean => {
  if (result.kind === "current") {
    return (
      versionReferencesVersion(result.version, versionId) ||
      profileReferencesVersion(result.profile, versionId)
    );
  }
  return (
    versionReferencesVersion(result.candidate, versionId) ||
    result.currentVersionId === versionId ||
    result.review.candidateVersionId === versionId
  );
};

const ingestResultReferencesVersion = (
  result: {
    readonly subject: SubjectSummary;
    readonly job?: PendingJob;
  },
  versionId: VersionId,
): boolean =>
  subjectReferencesVersion(result.subject, versionId) ||
  (result.job !== undefined && pendingReferencesVersion(result.job, versionId));

const operationReferencesVersion = (operation: OperationFact, versionId: VersionId): boolean => {
  if (operation.recordKind === "tombstone") return false;
  switch (operation.method) {
    case "subjects.create":
      return subjectReferencesVersion(operation.result, versionId);
    case "subjects.archive":
    case "subjects.purge":
    case "distill.renew":
    case "distill.release":
    case "hosts.uninstall":
    case "library.rebuild":
    case "bundles.export":
      return false;
    case "materials.ingest":
    case "materials.ingestFiles":
      return ingestResultReferencesVersion(operation.result, versionId);
    case "distill.brief":
      return (
        pendingReferencesVersion(operation.result.job, versionId) ||
        subjectReferencesVersion(operation.result.subject, versionId) ||
        operation.result.baseline?.versionId === versionId ||
        (operation.result.baseline !== undefined &&
          claimsReferenceVersion(operation.result.baseline.claims, versionId))
      );
    case "distill.commit":
    case "profiles.correct":
      return commitResultReferencesVersion(operation.result, versionId);
    case "distill.redistill":
      return pendingReferencesVersion(operation.result, versionId);
    case "versions.promote":
    case "versions.reject":
    case "versions.rollback":
      return versionReferencesVersion(operation.result, versionId);
    case "hosts.install":
    case "hosts.export":
      return operation.result.versionId === versionId;
    case "bundles.import":
      return (
        subjectReferencesVersion(operation.result.subject, versionId) ||
        versionReferencesVersion(operation.result.candidate, versionId) ||
        operation.result.review.candidateVersionId === versionId
      );
    default: {
      const exhaustive: never = operation;
      return exhaustive;
    }
  }
};

const eventReferencesVersion = (event: EngineEvent, versionId: VersionId): boolean =>
  event.versionId === versionId;

const eventRecordReferencesVersion = (event: EventRecord, versionId: VersionId): boolean =>
  eventReferencesVersion(event.event, versionId) || event.relatedVersionId === versionId;

const transactionReferencesVersion = (
  transaction: TransactionRecord,
  versionId: VersionId,
): boolean => {
  switch (transaction.transactionKind) {
    case "distill_lease":
      return (
        pendingReferencesVersion(transaction.previousPending, versionId) ||
        pendingReferencesVersion(transaction.targetPending, versionId) ||
        operationReferencesVersion(transaction.operation, versionId) ||
        eventReferencesVersion(transaction.event.event, versionId)
      );
    case "distill_commit":
      return (
        pendingReferencesVersion(transaction.previousPending, versionId) ||
        stateReferencesVersion(transaction.targetState, versionId) ||
        versionReferencesVersion(transaction.version, versionId) ||
        transaction.claims.versionId === versionId ||
        claimsReferenceVersion(transaction.claims.claims, versionId) ||
        profileReferencesVersion(transaction.profile, versionId) ||
        operationReferencesVersion(transaction.operation, versionId) ||
        transaction.events.some((event) => eventRecordReferencesVersion(event, versionId))
      );
    case "review_decision":
      return (
        transaction.candidateVersionId === versionId ||
        transaction.previousCurrentVersionId === versionId ||
        transaction.previousSuspendedVersionId === versionId ||
        (transaction.previousPending !== undefined &&
          pendingReferencesVersion(transaction.previousPending, versionId)) ||
        stateReferencesVersion(transaction.targetState, versionId) ||
        operationReferencesVersion(transaction.operation, versionId) ||
        transaction.events.some((event) => eventRecordReferencesVersion(event, versionId))
      );
    case "rollback":
      return (
        transaction.targetVersionId === versionId ||
        transaction.previousCurrentVersionId === versionId ||
        (transaction.previousPending !== undefined &&
          pendingReferencesVersion(transaction.previousPending, versionId)) ||
        stateReferencesVersion(transaction.targetState, versionId) ||
        versionReferencesVersion(transaction.version, versionId) ||
        transaction.claims.versionId === versionId ||
        claimsReferenceVersion(transaction.claims.claims, versionId) ||
        profileReferencesVersion(transaction.profile, versionId) ||
        operationReferencesVersion(transaction.operation, versionId) ||
        transaction.events.some((event) => eventRecordReferencesVersion(event, versionId))
      );
    default: {
      const exhaustive: never = transaction;
      return exhaustive;
    }
  }
};

const terminalTime = (preparedAt: IsoDateTime, now: IsoDateTime): IsoDateTime =>
  now < preparedAt ? preparedAt : now;

const commitArtifacts = (transaction: DistillCommitTransactionRecord): VersionArtifactSet => ({
  version: transaction.version,
  manifest: transaction.materialManifest,
  claims: transaction.claims,
  profile: transaction.profile,
  prompt: transaction.prompt,
});

const exactArtifacts = (left: VersionArtifactSet, right: VersionArtifactSet): boolean =>
  canonicalJson(left) === canonicalJson(right);

const creationEventsFor = (
  events: readonly EventRecord[],
  versionId: VersionId,
): readonly EventRecord[] =>
  events.filter(
    (record) =>
      record.event.versionId === versionId &&
      (record.event.kind === "version.current" ||
        record.event.kind === "version.suspended" ||
        record.event.kind === "version.rolled_back"),
  );

const expectedCreationKind = (
  version: VersionRecord,
): "version.current" | "version.suspended" | "version.rolled_back" =>
  version.creation.kind === "rollback"
    ? "version.rolled_back"
    : version.createdDisposition === "current"
      ? "version.current"
      : "version.suspended";

const assertVersionCreationEvent = (
  version: VersionRecord,
  events: readonly EventRecord[],
): void => {
  const creationEvents = creationEventsFor(events, version.id);
  const creation = creationEvents[0];
  if (
    creationEvents.length !== 1 ||
    creation === undefined ||
    creation.event.kind !== expectedCreationKind(version) ||
    creation.event.at !== version.createdAt ||
    canonicalJson(creation.actor) !== canonicalJson(version.actor) ||
    (version.creation.kind === "rollback" &&
      creation.relatedVersionId !== version.creation.targetVersionId)
  ) {
    throw storageCorrupt("A journal version is missing its exact durable creation event.");
  }
};

const assertJournalEventMaterialization = (
  transactionState: TransactionRecord["state"],
  expected: EventRecord,
  durable: readonly EventRecord[],
  message: string,
): void => {
  if (
    durable.length > 1 ||
    durable.some((record) => canonicalJson(record) !== canonicalJson(expected)) ||
    (transactionState === "committed" && durable.length !== 1) ||
    (transactionState === "aborted" && durable.length !== 0)
  ) {
    throw storageCorrupt(message);
  }
};

const assertJournalEventTupleMaterialization = (
  transaction: Pick<TransactionRecord, "requestId" | "state"> & {
    readonly events: readonly EventRecord[];
  },
  durable: readonly EventRecord[],
  message: string,
): void => {
  const materialized = durable.filter((record) => record.requestId === transaction.requestId);
  let expectedCount: number;
  if (transaction.state === "committed") {
    expectedCount = transaction.events.length;
  } else if (transaction.state === "aborted") {
    expectedCount = 0;
  } else {
    expectedCount = 0;
    while (
      expectedCount < transaction.events.length &&
      materialized.some((record) => record.eventId === transaction.events[expectedCount]?.eventId)
    ) {
      expectedCount += 1;
    }
  }
  if (materialized.length !== expectedCount) throw storageCorrupt(message);
  for (let index = 0; index < expectedCount; index += 1) {
    const expected = transaction.events[index];
    const actual = materialized.find((record) => record.eventId === expected?.eventId);
    if (
      expected === undefined ||
      actual === undefined ||
      canonicalJson(actual) !== canonicalJson(expected)
    ) {
      throw storageCorrupt(message);
    }
  }
};

const rollbackArtifacts = (transaction: RollbackTransactionRecord): VersionArtifactSet => ({
  version: transaction.version,
  manifest: transaction.materialManifest,
  claims: transaction.claims,
  profile: transaction.profile,
  prompt: transaction.prompt,
});

const versionSummary = (
  version: VersionRecord,
  status: "current" | "suspended" | "historical" | "rejected",
): VersionSummary => ({
  id: version.id,
  subjectId: version.subjectId,
  ...(version.parentId === undefined ? {} : { parentId: version.parentId }),
  ...(version.derivedFromCandidateVersionId === undefined
    ? {}
    : { derivedFromCandidateVersionId: version.derivedFromCandidateVersionId }),
  generation: version.generation,
  materialSetHash: version.materialSetHash,
  creation: version.creation,
  status,
  actor: version.actor,
  quality: version.quality,
  createdAt: version.createdAt,
});

const expectedReviewInputChecksum = (
  transaction: ReviewDecisionTransactionRecord,
): OperationFact["inputChecksum"] => {
  const reason = transaction.events[0].reason;
  return computeFactChecksum({
    method: `versions.${transaction.method}`,
    params: {
      subjectId: transaction.subjectId,
      candidateVersionId: transaction.candidateVersionId,
      ...(reason === undefined ? {} : { reason }),
    },
    actor: transaction.operation.actor,
  });
};

/**
 * Verifies the deterministic fields of one review-decision journal target.
 *
 * @param transaction - Journal retaining the exact target and derived side effects.
 * @param state - State expected to equal the journal target byte-for-byte.
 */
export const validateReviewTransactionTarget = (
  transaction: ReviewDecisionTransactionRecord,
  state: SubjectStateRecord,
): void => {
  verifyFactChecksum(transaction.targetState);
  verifyFactChecksum(transaction.operation);
  for (const event of transaction.events) verifyFactChecksum(event);
  if (
    state.checksum !== transaction.targetState.checksum ||
    canonicalJson(state) !== canonicalJson(transaction.targetState)
  ) {
    throw storageCorrupt("Recovered review target state does not match its journal payload.");
  }
  if (transaction.operation.inputChecksum !== expectedReviewInputChecksum(transaction)) {
    throw storageCorrupt("Recovered review operation does not match its trusted input preimage.");
  }
  const previousPayload = {
    schemaVersion: 2,
    subjectId: transaction.subjectId,
    generation: transaction.targetState.generation,
    ...(transaction.targetState.materialSetHash === undefined
      ? {}
      : { materialSetHash: transaction.targetState.materialSetHash }),
    materialManifest: transaction.targetState.materialManifest,
    ...(transaction.previousCurrentVersionId === undefined
      ? {}
      : { currentVersionId: transaction.previousCurrentVersionId }),
    suspendedVersionId: transaction.previousSuspendedVersionId,
    ...(transaction.previousPending === undefined ? {} : { pending: transaction.previousPending }),
  } as const;
  if (computeFactChecksum(previousPayload) !== transaction.previousStateChecksum) {
    throw storageCorrupt("A review journal cannot reconstruct its exact previous state.");
  }
};

const expectedRollbackInputChecksum = (
  transaction: RollbackTransactionRecord,
): OperationFact["inputChecksum"] => {
  const reason = transaction.events[0].reason;
  if (reason === undefined) {
    throw storageCorrupt("A rollback journal is missing its required reason.");
  }
  return computeFactChecksum({
    method: "versions.rollback",
    params: {
      subjectId: transaction.subjectId,
      targetVersionId: transaction.targetVersionId,
      reason,
    },
    actor: transaction.operation.actor,
  });
};

/**
 * Verifies the deterministic fields and complete artifacts of one rollback journal target.
 *
 * @param transaction - Journal retaining the copied immutable artifacts.
 * @param state - State expected to equal the journal target byte-for-byte.
 * @returns The normalized immutable rollback artifact set.
 */
export const validateRollbackTransactionTarget = (
  transaction: RollbackTransactionRecord,
  state: SubjectStateRecord,
): VersionArtifactSet => {
  verifyFactChecksum(transaction.targetState);
  verifyFactChecksum(transaction.operation);
  for (const event of transaction.events) verifyFactChecksum(event);
  if (
    state.checksum !== transaction.targetState.checksum ||
    canonicalJson(state) !== canonicalJson(transaction.targetState)
  ) {
    throw storageCorrupt("Recovered rollback target state does not match its journal payload.");
  }
  if (transaction.operation.inputChecksum !== expectedRollbackInputChecksum(transaction)) {
    throw storageCorrupt("Recovered rollback operation does not match its trusted input preimage.");
  }
  const previousPayload = {
    schemaVersion: 2,
    subjectId: transaction.subjectId,
    generation: transaction.targetState.generation,
    ...(transaction.targetState.materialSetHash === undefined
      ? {}
      : { materialSetHash: transaction.targetState.materialSetHash }),
    materialManifest: transaction.targetState.materialManifest,
    currentVersionId: transaction.previousCurrentVersionId,
    ...(transaction.previousPending === undefined ? {} : { pending: transaction.previousPending }),
  } as const;
  if (computeFactChecksum(previousPayload) !== transaction.previousStateChecksum) {
    throw storageCorrupt("A rollback journal cannot reconstruct its exact previous state.");
  }
  if (
    transaction.version.reviewReasons !== undefined ||
    transaction.version.derivedFromCandidateVersionId !== undefined
  ) {
    throw storageCorrupt("A rollback version cannot retain review or candidate derivation fields.");
  }
  return validateVersionArtifactSet(rollbackArtifacts(transaction));
};

const assertManifestSubsetAndDelta = (
  state: SubjectStateRecord,
  manifest: VersionArtifactSet["manifest"],
): number => {
  const current = new Map(state.materialManifest.map((entry) => [entry.materialId, entry]));
  for (const entry of manifest.items) {
    const authoritative = current.get(entry.materialId);
    if (
      authoritative === undefined ||
      authoritative.contentDigest !== entry.contentDigest ||
      authoritative.provenanceDigest !== entry.provenanceDigest
    ) {
      throw storageCorrupt("A review baseline is not an exact subset of authoritative materials.");
    }
  }
  return state.materialManifest.length - manifest.items.length;
};

const assertRebasedPending = (
  state: SubjectStateRecord,
  previousPending: PendingJobMarker | undefined,
  baseline: VersionArtifactSet["manifest"],
  baseVersionId: VersionId,
  preparedAt: IsoDateTime,
): void => {
  const delta = assertManifestSubsetAndDelta(state, baseline);
  if (previousPending === undefined || delta === 0) {
    if (state.pending !== undefined) {
      throw storageCorrupt("A zero-delta or previously absent review job must remain absent.");
    }
    return;
  }
  const pending = state.pending;
  if (
    pending === undefined ||
    pending.jobId === previousPending.jobId ||
    pending.generation !== state.generation ||
    pending.baseVersionId !== baseVersionId ||
    pending.materialSetHash !== state.materialSetHash ||
    pending.addedMaterialCount !== delta ||
    pending.totalMaterialCount !== state.materialManifest.length ||
    pending.queuedAt !== preparedAt ||
    pending.lease !== undefined
  ) {
    throw storageCorrupt("A review transaction does not contain the exact rebased pending job.");
  }
};

/**
 * Verifies every deterministic, trusted, and checksummed field of a commit target.
 *
 * @param transaction - The journal whose exact target is about to be written or recovered.
 * @param state - The authoritative target state visible at the validation boundary.
 * @returns The fully validated immutable version artifact set owned by the journal.
 */
export const validateCommitTransactionTarget = (
  transaction: DistillCommitTransactionRecord,
  state: SubjectStateRecord,
): VersionArtifactSet => {
  verifyFactChecksum(transaction.targetState);
  verifyFactChecksum(transaction.operation);
  for (const event of transaction.events) verifyFactChecksum(event);
  const lease = transaction.previousPending.lease;
  if (
    lease === undefined ||
    lease.id !== transaction.leaseId ||
    lease.owner !== transaction.leaseOwner ||
    digestBriefContract(lease.contract) !== lease.contract.digest ||
    transaction.preparedAt >= lease.expiresAt
  ) {
    throw storageCorrupt("Recovered commit journal does not retain its active verified lease.");
  }
  const inputChecksum = computeFactChecksum({
    method: "distill.commit",
    params: {
      jobId: transaction.jobId,
      generation: transaction.previousPending.generation,
      leaseId: transaction.leaseId,
      briefContractDigest: lease.contract.digest,
      materialSetHash: transaction.previousPending.materialSetHash,
      ...(transaction.previousPending.baseVersionId === undefined
        ? {}
        : { baseVersionId: transaction.previousPending.baseVersionId }),
      patch: transaction.acceptedPatch,
    },
    actor: transaction.operation.actor,
    leaseOwner: transaction.leaseOwner,
  });
  if (transaction.operation.inputChecksum !== inputChecksum) {
    throw storageCorrupt("Recovered commit operation does not match its trusted input preimage.");
  }
  if (
    state.checksum !== transaction.targetState.checksum ||
    canonicalJson(state) !== canonicalJson(transaction.targetState)
  ) {
    throw storageCorrupt("Recovered commit target state does not match its journal payload.");
  }
  if (digestDistillPatch(transaction.acceptedPatch) !== transaction.patchDigest) {
    throw storageCorrupt("Recovered commit patch digest does not match its accepted patch.");
  }
  return validateVersionArtifactSet(commitArtifacts(transaction));
};

const expectedLeaseExpiry = (completedAt: IsoDateTime): string =>
  new Date(Date.parse(completedAt) + 30 * 60 * 1_000).toISOString();

const assertLeaseTransitionTime = (transaction: DistillLeaseTransactionRecord): void => {
  verifyFactChecksum(transaction.operation);
  verifyFactChecksum(transaction.event);
  const previousLease = transaction.previousPending.lease;
  const targetLease = transaction.targetPending.lease;
  switch (transaction.method) {
    case "brief":
      if (
        targetLease === undefined ||
        targetLease.acquiredAt !== transaction.operation.completedAt ||
        targetLease.expiresAt !== expectedLeaseExpiry(transaction.operation.completedAt) ||
        (previousLease !== undefined && previousLease.expiresAt > targetLease.acquiredAt)
      ) {
        throw storageCorrupt(
          "Recovered brief journal does not describe a valid lease acquisition.",
        );
      }
      return;
    case "renew":
      if (
        previousLease === undefined ||
        targetLease === undefined ||
        transaction.operation.completedAt < previousLease.acquiredAt ||
        previousLease.expiresAt <= transaction.operation.completedAt ||
        targetLease.expiresAt !== expectedLeaseExpiry(transaction.operation.completedAt)
      ) {
        throw storageCorrupt("Recovered renew journal does not describe an active lease.");
      }
      return;
    case "release":
      if (
        previousLease === undefined ||
        targetLease !== undefined ||
        previousLease.expiresAt <= transaction.operation.completedAt
      ) {
        throw storageCorrupt("Recovered release journal does not describe an active lease.");
      }
      return;
    default: {
      const exhaustive: never = transaction;
      return exhaustive;
    }
  }
};

const assertLeaseState = (
  transaction: DistillLeaseTransactionRecord,
  state: SubjectStateRecord,
  position: "previous" | "target",
): void => {
  assertLeaseTransitionTime(transaction);
  if (state.subjectId !== transaction.subjectId || state.pending === undefined) {
    throw storageCorrupt("Recovered lease state does not contain the journal-owned pending job.");
  }
  const expectedPending =
    position === "target" ? transaction.targetPending : transaction.previousPending;
  if (!samePending(state.pending, expectedPending)) {
    throw storageCorrupt("Recovered lease state pending marker does not match its journal.");
  }
  const counterpartPending =
    position === "target" ? transaction.previousPending : transaction.targetPending;
  const counterpartChecksum = computeFactChecksum(
    statePayloadWithPending(state, counterpartPending),
  );
  const expectedCounterpartChecksum =
    position === "target" ? transaction.previousStateChecksum : transaction.targetStateChecksum;
  if (counterpartChecksum !== expectedCounterpartChecksum) {
    throw storageCorrupt("Recovered lease journal changes state outside the pending lease marker.");
  }
};

/** Optional subject projection updated only after authoritative fact commit. */
export interface SubjectProjection {
  apply(subjectId: SubjectId): Promise<"clean" | "dirty">;
  hasWriterIntent?(): Promise<boolean>;
  completeWriter?(subjectId: SubjectId): Promise<void>;
  settleReconciledIntent?(
    hasPreparedJournal: () => Promise<boolean>,
  ): Promise<"pending" | "settled">;
}

/** Concrete stores, locks, projection, and trusted seams used by recovery. */
export interface RecoveryDependencies {
  readonly transactions: FileTransactionStore;
  readonly operations: FileOperationStore;
  readonly subjects: FileSubjectStore;
  readonly states: FileStateStore;
  readonly events: FileEventStore;
  readonly versions: FileVersionStore;
  readonly versionStaging: FileVersionStaging;
  readonly currentProfiles: FileCurrentProfileProjection;
  readonly requestLocks: FileRequestLock;
  readonly subjectLocks: FileSubjectLock;
  readonly queue: QueueRepository;
  readonly library?: SubjectProjection;
  readonly eventBus: EventBus;
  readonly clock: Clock;
  readonly hooks?: RecoveryHooks;
}

/** Reconciles prepared lease, commit, review, and rollback journals. */
export class RecoveryService {
  readonly #transactions: FileTransactionStore;
  readonly #operations: FileOperationStore;
  readonly #subjects: FileSubjectStore;
  readonly #states: FileStateStore;
  readonly #events: FileEventStore;
  readonly #versions: FileVersionStore;
  readonly #versionStaging: FileVersionStaging;
  readonly #currentProfiles: FileCurrentProfileProjection;
  readonly #requestLocks: FileRequestLock;
  readonly #subjectLocks: FileSubjectLock;
  readonly #queue: QueueRepository;
  readonly #library: SubjectProjection | undefined;
  readonly #eventBus: EventBus;
  readonly #clock: Clock;
  readonly #hooks: RecoveryHooks;

  /**
   * Creates the package-internal recovery coordinator.
   *
   * @param input - Concrete stores, locks, projection, and trusted seams.
   */
  constructor(input: RecoveryDependencies) {
    this.#transactions = input.transactions;
    this.#operations = input.operations;
    this.#subjects = input.subjects;
    this.#states = input.states;
    this.#events = input.events;
    this.#versions = input.versions;
    this.#versionStaging = input.versionStaging;
    this.#currentProfiles = input.currentProfiles;
    this.#requestLocks = input.requestLocks;
    this.#subjectLocks = input.subjectLocks;
    this.#queue = input.queue;
    this.#library = input.library;
    this.#eventBus = input.eventBus;
    this.#clock = input.clock;
    this.#hooks = input.hooks ?? {};
  }

  /** Reconciles every currently visible prepared journal in RequestId order. */
  async reconcileAll(): Promise<void> {
    for (;;) {
      for (const transaction of await this.#transactions.list()) {
        if (transaction.state === "prepared") {
          await this.reconcileRequest(transaction.requestId);
        }
      }
      if ((await this.settleLibraryIntent()) === "settled") return;
    }
  }

  /**
   * Reconciles only when the durable Library intent proves a writer may be pending.
   *
   * Startup still calls {@link reconcileAll}; post-startup reads and mutations use
   * this O(1) clean-path probe so permanent terminal journals are not rescanned.
   */
  async reconcilePending(): Promise<void> {
    if (this.#library?.hasWriterIntent === undefined) {
      await this.reconcileAll();
      return;
    }
    if (!(await this.#library.hasWriterIntent())) return;
    await this.reconcileAll();
  }

  /**
   * Reconciles one prepared request under the canonical root-to-subject lock order.
   *
   * @param requestId - Root transaction id to inspect.
   */
  async reconcile(requestId: RequestId): Promise<void> {
    await this.reconcileRequest(requestId);
    await this.settleLibraryIntent();
  }

  private async reconcileRequest(requestId: RequestId): Promise<void> {
    const requestLease = await this.#requestLocks.acquire(requestId);
    let publishedEvents: readonly EngineEvent[];
    try {
      const transaction = await this.#transactions.readOptional(requestId);
      if (transaction === undefined || transaction.state !== "prepared") return;

      const subjectLease = await this.#subjectLocks.acquire(transaction.subjectId);
      try {
        publishedEvents = await this.reconcileLocked(transaction);
      } finally {
        await subjectLease.release();
      }
    } finally {
      await requestLease.release();
    }
    for (const event of publishedEvents) await this.#eventBus.publish(event);
  }

  private async settleLibraryIntent(): Promise<"pending" | "settled"> {
    if (this.#library?.settleReconciledIntent === undefined) return "settled";
    return this.#library.settleReconciledIntent(async () =>
      (await this.#transactions.list()).some((transaction) => transaction.state === "prepared"),
    );
  }

  /**
   * Materializes one already-committed lease mutation from its exact journal payload.
   *
   * The caller must hold the journal's request and subject locks. The returned
   * event is published only after those locks have been released.
   *
   * @param transaction - Prepared lease journal whose target state is visible.
   * @param state - Verified target state currently visible at the subject path.
   * @returns The exact persisted invalidation ready for post-lock publication.
   */
  async materializeLeaseCommitted(
    transaction: DistillLeaseTransactionRecord,
    state: SubjectStateRecord,
  ): Promise<readonly EngineEvent[]> {
    if (transaction.state !== "prepared" || state.checksum !== transaction.targetStateChecksum) {
      throw storageCorrupt("Only a visible prepared lease target can be materialized.");
    }
    assertLeaseState(transaction, state, "target");
    await this.#operations.write(transaction.operation);
    await this.#hooks.afterOperation?.();
    await this.#events.write(transaction.subjectId, transaction.event);
    await this.#hooks.afterEvent?.(transaction.event.eventId);
    await this.#queue.apply({
      subjectId: transaction.subjectId,
      stateChecksum: state.checksum,
      pending: transaction.targetPending,
    });
    await this.#hooks.afterQueue?.();
    const libraryStatus = await this.applyLibrary(transaction.subjectId);
    await this.#transactions.write(
      terminalLeaseTransaction(
        transaction,
        "committed",
        terminalTime(transaction.preparedAt, this.#clock.now()),
      ),
    );
    if (libraryStatus === "clean") await this.completeLibraryWriter(transaction.subjectId);
    return [transaction.event.event];
  }

  /**
   * Materializes post-commit facts and projections for one visible version target.
   *
   * The caller holds the journal request and subject locks. Returned events are
   * published only after those locks are released.
   *
   * @param transaction - Prepared commit journal whose target state is visible.
   * @param state - Verified authoritative target state.
   * @returns The exact persisted event tuple ready for publication.
   */
  async materializeCommitCommitted(
    transaction: DistillCommitTransactionRecord,
    state: SubjectStateRecord,
  ): Promise<readonly EngineEvent[]> {
    if (transaction.state !== "prepared" || state.checksum !== transaction.targetState.checksum) {
      throw storageCorrupt("Only a visible prepared commit target can be materialized.");
    }
    const artifacts = validateCommitTransactionTarget(transaction, state);
    const stored = await this.#versions.read(transaction.subjectId, transaction.version.id);
    if (!exactArtifacts(stored, artifacts)) {
      throw storageCorrupt("Published version artifacts do not match their commit journal.");
    }
    await this.#operations.write(transaction.operation);
    await this.#hooks.afterOperation?.();
    for (const record of transaction.events) {
      await this.#events.write(transaction.subjectId, record);
      await this.#hooks.afterEvent?.(record.eventId);
    }
    if (transaction.version.createdDisposition === "current") {
      await this.#currentProfiles.recover(transaction.requestId, artifacts);
      await this.#hooks.afterCurrentProfile?.();
    }
    await this.#queue.apply({
      subjectId: transaction.subjectId,
      stateChecksum: state.checksum,
    });
    await this.#hooks.afterQueue?.();
    const libraryStatus = await this.applyLibrary(transaction.subjectId);
    await this.#transactions.write(
      terminalCommitTransaction(
        transaction,
        "committed",
        terminalTime(transaction.preparedAt, this.#clock.now()),
      ),
    );
    await this.#hooks.afterCommitTerminal?.();
    if (libraryStatus === "clean") await this.completeLibraryWriter(transaction.subjectId);
    return transaction.events.map((record) => record.event);
  }

  /**
   * Verifies immutable candidate semantics retained by a review journal.
   *
   * @param transaction - Prepared or terminal review journal to validate.
   * @returns The verified immutable candidate referenced by the journal.
   */
  async validateReviewJournalSemantics(
    transaction: ReviewDecisionTransactionRecord,
  ): Promise<StoredCompleteVersion> {
    validateReviewTransactionTarget(transaction, transaction.targetState);
    const candidate = await requiredVersion(
      this.#versions,
      transaction.subjectId,
      transaction.candidateVersionId,
      "A review journal references a missing immutable candidate.",
    );
    if (
      candidate.version.createdDisposition !== "suspended" ||
      candidate.version.reviewReasons === undefined ||
      candidate.version.parentId !== transaction.previousCurrentVersionId ||
      canonicalJson(transaction.operation.result) !==
        canonicalJson(
          versionSummary(
            candidate.version,
            transaction.method === "promote" ? "current" : "rejected",
          ),
        )
    ) {
      throw storageCorrupt("Reviewed candidate does not match its transaction result or parent.");
    }
    const durableEvents = await this.#events.list(transaction.subjectId);
    assertVersionCreationEvent(candidate.version, durableEvents);
    assertJournalEventMaterialization(
      transaction.state,
      transaction.events[0],
      durableEvents.filter(
        (record) =>
          record.event.versionId === transaction.candidateVersionId &&
          (record.event.kind === "version.promoted" || record.event.kind === "version.rejected"),
      ),
      "A review journal disagrees with the durable candidate decision event.",
    );
    assertJournalEventTupleMaterialization(
      transaction,
      durableEvents,
      "A review journal disagrees with its complete durable event tuple.",
    );
    if (transaction.method === "promote") {
      assertRebasedPending(
        transaction.targetState,
        transaction.previousPending,
        candidate.manifest,
        candidate.version.id,
        transaction.preparedAt,
      );
    } else if (!samePendingFacts(transaction.targetState.pending, transaction.previousPending)) {
      throw storageCorrupt("Reject recovery does not preserve pending work exactly.");
    }
    return candidate;
  }

  /**
   * Verifies copied source semantics and the required publication state of a rollback journal.
   *
   * @param transaction - Prepared or terminal rollback journal to validate.
   * @param publication - Required, absent, or either exact publication state.
   * @returns The normalized immutable rollback artifact set.
   */
  async validateRollbackJournalSemantics(
    transaction: RollbackTransactionRecord,
    publication: "required" | "absent" | "optional" = "required",
  ): Promise<VersionArtifactSet> {
    const artifacts = validateRollbackTransactionTarget(transaction, transaction.targetState);
    if (publication === "required") {
      const stored = await requiredVersion(
        this.#versions,
        transaction.subjectId,
        transaction.version.id,
        "A committed rollback journal references a missing published version.",
      );
      if (!exactArtifacts(stored, artifacts)) {
        throw storageCorrupt("Published rollback artifacts do not match their journal.");
      }
    } else {
      const stored = (await this.#versions.list(transaction.subjectId)).find(
        (candidate) => candidate.version.id === transaction.version.id,
      );
      if (publication === "absent" && stored !== undefined) {
        throw storageCorrupt("An aborted rollback journal retains its unpublished target version.");
      }
      if (
        publication === "optional" &&
        stored !== undefined &&
        !exactArtifacts(stored, artifacts)
      ) {
        throw storageCorrupt("Published rollback artifacts do not match their journal.");
      }
    }
    const source = await requiredVersion(
      this.#versions,
      transaction.subjectId,
      transaction.targetVersionId,
      "A rollback journal references a missing historical source.",
    );
    await requiredVersion(
      this.#versions,
      transaction.subjectId,
      transaction.previousCurrentVersionId,
      "A rollback journal references a missing previous current version.",
    );
    if (
      canonicalJson(transaction.operation.result) !==
      canonicalJson(versionSummary(transaction.version, "current"))
    ) {
      throw storageCorrupt("A rollback operation result does not match its immutable version.");
    }
    const [durableVersions, durableEvents] = await Promise.all([
      this.#versions.list(transaction.subjectId),
      this.#events.list(transaction.subjectId),
    ]);
    validateRollbackHistoricalCopy(
      artifacts,
      new Map(durableVersions.map((stored) => [stored.version.id, stored] as const)),
      durableEvents,
    );
    assertVersionCreationEvent(source.version, durableEvents);
    const sourceDecisions = durableEvents.filter(
      (record) =>
        record.event.versionId === transaction.targetVersionId &&
        (record.event.kind === "version.promoted" || record.event.kind === "version.rejected"),
    );
    if (
      source.version.createdAt > transaction.preparedAt ||
      (source.version.createdDisposition === "current" && sourceDecisions.length !== 0) ||
      (source.version.createdDisposition === "suspended" &&
        (sourceDecisions.length !== 1 ||
          sourceDecisions[0]?.event.kind !== "version.promoted" ||
          sourceDecisions[0].event.at < source.version.createdAt ||
          sourceDecisions[0].event.at > transaction.preparedAt))
    ) {
      throw storageCorrupt("A rollback journal source was not historical when it was prepared.");
    }
    assertJournalEventMaterialization(
      transaction.state,
      transaction.events[0],
      creationEventsFor(durableEvents, transaction.version.id),
      "A rollback journal disagrees with its durable creation event.",
    );
    assertJournalEventTupleMaterialization(
      transaction,
      durableEvents,
      "A rollback journal disagrees with its complete durable event tuple.",
    );
    assertRebasedPending(
      transaction.targetState,
      transaction.previousPending,
      transaction.materialManifest,
      transaction.version.id,
      transaction.preparedAt,
    );
    return artifacts;
  }

  /**
   * Materializes a visible promote or reject target from its exact journal payload.
   *
   * @param transaction - Prepared review journal whose fact commit point is visible.
   * @param state - Exact visible target state.
   * @returns Durable events ready for best-effort publication.
   */
  async materializeReviewCommitted(
    transaction: ReviewDecisionTransactionRecord,
    state: SubjectStateRecord,
  ): Promise<readonly EngineEvent[]> {
    if (transaction.state !== "prepared") {
      throw storageCorrupt("Only a visible prepared review target can be materialized.");
    }
    validateReviewTransactionTarget(transaction, state);
    const candidate = await this.validateReviewJournalSemantics(transaction);

    await this.#operations.write(transaction.operation);
    await this.#hooks.afterOperation?.();
    for (const record of transaction.events) {
      await this.#events.write(transaction.subjectId, record);
      await this.#hooks.afterEvent?.(record.eventId);
    }
    if (transaction.method === "promote") {
      await this.#currentProfiles.recover(transaction.requestId, candidate);
      await this.#hooks.afterCurrentProfile?.();
    }
    await this.#queue.apply({
      subjectId: transaction.subjectId,
      stateChecksum: state.checksum,
      ...(state.pending === undefined ? {} : { pending: state.pending }),
    });
    await this.#hooks.afterQueue?.();
    const libraryStatus = await this.applyLibrary(transaction.subjectId);
    await this.#transactions.write(
      terminalReviewTransaction(
        transaction,
        "committed",
        terminalTime(transaction.preparedAt, this.#clock.now()),
      ),
    );
    await this.#hooks.afterReviewTerminal?.();
    if (libraryStatus === "clean") await this.completeLibraryWriter(transaction.subjectId);
    return transaction.events.map((record) => record.event);
  }

  /**
   * Materializes a visible rollback-created version from its exact journal payload.
   *
   * @param transaction - Prepared rollback journal whose fact commit point is visible.
   * @param state - Exact visible target state.
   * @returns Durable events ready for best-effort publication.
   */
  async materializeRollbackCommitted(
    transaction: RollbackTransactionRecord,
    state: SubjectStateRecord,
  ): Promise<readonly EngineEvent[]> {
    if (transaction.state !== "prepared") {
      throw storageCorrupt("Only a visible prepared rollback target can be materialized.");
    }
    validateRollbackTransactionTarget(transaction, state);
    const artifacts = await this.validateRollbackJournalSemantics(transaction);

    await this.#operations.write(transaction.operation);
    await this.#hooks.afterOperation?.();
    for (const record of transaction.events) {
      await this.#events.write(transaction.subjectId, record);
      await this.#hooks.afterEvent?.(record.eventId);
    }
    await this.#currentProfiles.recover(transaction.requestId, artifacts);
    await this.#hooks.afterCurrentProfile?.();
    await this.#queue.apply({
      subjectId: transaction.subjectId,
      stateChecksum: state.checksum,
      ...(state.pending === undefined ? {} : { pending: state.pending }),
    });
    await this.#hooks.afterQueue?.();
    const libraryStatus = await this.applyLibrary(transaction.subjectId);
    await this.#transactions.write(
      terminalRollbackTransaction(
        transaction,
        "committed",
        terminalTime(transaction.preparedAt, this.#clock.now()),
      ),
    );
    await this.#hooks.afterRollbackTerminal?.();
    if (libraryStatus === "clean") await this.completeLibraryWriter(transaction.subjectId);
    return transaction.events.map((record) => record.event);
  }

  private async applyLibrary(subjectId: SubjectId): Promise<"clean" | "dirty"> {
    if (this.#library === undefined) return "clean";
    const status = await this.#library.apply(subjectId);
    await this.#hooks.afterLibrary?.();
    return status;
  }

  private async completeLibraryWriter(subjectId: SubjectId): Promise<void> {
    await this.#library?.completeWriter?.(subjectId);
  }

  private async reconcileLocked(transaction: TransactionRecord): Promise<readonly EngineEvent[]> {
    switch (transaction.transactionKind) {
      case "distill_lease":
        return this.reconcileLeaseLocked(transaction);
      case "distill_commit":
        return this.reconcileCommitLocked(transaction);
      case "review_decision":
        return this.reconcileReviewLocked(transaction);
      case "rollback":
        return this.reconcileRollbackLocked(transaction);
      default: {
        const exhaustive: never = transaction;
        return exhaustive;
      }
    }
  }

  private async reconcileLeaseLocked(
    transaction: DistillLeaseTransactionRecord,
  ): Promise<readonly EngineEvent[]> {
    const subject = await optionalSubject(this.#subjects, transaction.subjectId);
    if (subject === undefined) {
      throw storageCorrupt("Prepared lease journal references a missing subject.");
    }
    const state = await optionalState(this.#states, transaction.subjectId);
    if (state === undefined) {
      throw storageCorrupt("Prepared lease journal references a missing subject state.");
    }

    if (state.checksum === transaction.targetStateChecksum) {
      return this.materializeLeaseCommitted(transaction, state);
    }
    if (state.checksum === transaction.previousStateChecksum) {
      assertLeaseState(transaction, state, "previous");
      const operation = await this.#operations.readOptional(transaction.requestId);
      const event = await optionalEvent(
        this.#events,
        transaction.subjectId,
        transaction.event.eventId,
      );
      if (operation !== undefined || event !== undefined) {
        throw storageCorrupt(
          "A previous-state lease journal cannot have post-commit operation or event facts.",
        );
      }
      await this.#transactions.write(
        terminalLeaseTransaction(
          transaction,
          "aborted",
          terminalTime(transaction.preparedAt, this.#clock.now()),
        ),
      );
      return [];
    }
    throw storageCorrupt("Prepared lease is neither at its target nor its previous fact state.");
  }

  private async reconcileCommitLocked(
    transaction: DistillCommitTransactionRecord,
  ): Promise<readonly EngineEvent[]> {
    const subject = await optionalSubject(this.#subjects, transaction.subjectId);
    if (subject === undefined) {
      throw storageCorrupt("Prepared commit journal references a missing subject.");
    }
    const state = await optionalState(this.#states, transaction.subjectId);
    if (state === undefined) {
      throw storageCorrupt("Prepared commit journal references a missing subject state.");
    }

    if (state.checksum === transaction.targetState.checksum) {
      return this.materializeCommitCommitted(transaction, state);
    }
    if (state.checksum !== transaction.previousStateChecksum) {
      throw storageCorrupt("Prepared commit is neither at its target nor its previous fact state.");
    }
    if (
      state.pending === undefined ||
      canonicalJson(state.pending) !== canonicalJson(transaction.previousPending)
    ) {
      throw storageCorrupt(
        "Previous commit state does not retain its journal-owned pending lease.",
      );
    }
    const operation = await this.#operations.readOptional(transaction.requestId);
    const events = await Promise.all(
      transaction.events.map((record) =>
        optionalEvent(this.#events, transaction.subjectId, record.eventId),
      ),
    );
    if (operation !== undefined || events.some((event) => event !== undefined)) {
      throw storageCorrupt(
        "A previous-state commit journal cannot have post-commit operation or event facts.",
      );
    }

    const artifacts = validateCommitTransactionTarget(transaction, transaction.targetState);
    await this.#versionStaging.cleanup(transaction.requestId, artifacts);
    await this.#versionStaging.removePublishedExact(
      transaction.requestId,
      artifacts,
      async (subjectId, versionId) => {
        await this.verifyVersionUnreferencedForCleanup(transaction.requestId, subjectId, versionId);
      },
    );
    await this.#transactions.write(
      terminalCommitTransaction(
        transaction,
        "aborted",
        terminalTime(transaction.preparedAt, this.#clock.now()),
      ),
    );
    return [];
  }

  private async reconcileReviewLocked(
    transaction: ReviewDecisionTransactionRecord,
  ): Promise<readonly EngineEvent[]> {
    const subject = await optionalSubject(this.#subjects, transaction.subjectId);
    if (subject === undefined) {
      throw storageCorrupt("Prepared review journal references a missing subject.");
    }
    const state = await optionalState(this.#states, transaction.subjectId);
    if (state === undefined) {
      throw storageCorrupt("Prepared review journal references a missing subject state.");
    }

    if (state.checksum === transaction.targetState.checksum) {
      return this.materializeReviewCommitted(transaction, state);
    }
    if (state.checksum !== transaction.previousStateChecksum) {
      throw storageCorrupt("Prepared review is neither at its target nor its previous fact state.");
    }
    if (
      state.currentVersionId !== transaction.previousCurrentVersionId ||
      state.suspendedVersionId !== transaction.previousSuspendedVersionId ||
      !samePendingFacts(state.pending, transaction.previousPending) ||
      state.generation !== transaction.targetState.generation ||
      state.materialSetHash !== transaction.targetState.materialSetHash ||
      canonicalJson(state.materialManifest) !==
        canonicalJson(transaction.targetState.materialManifest)
    ) {
      throw storageCorrupt("Previous review state does not match its exact journal fields.");
    }
    await this.validateReviewJournalSemantics(transaction);
    const operation = await this.#operations.readOptional(transaction.requestId);
    const events = await Promise.all(
      transaction.events.map((record) =>
        optionalEvent(this.#events, transaction.subjectId, record.eventId),
      ),
    );
    if (operation !== undefined || events.some((event) => event !== undefined)) {
      throw storageCorrupt(
        "A previous-state review journal cannot have post-commit operation or event facts.",
      );
    }
    await this.#transactions.write(
      terminalReviewTransaction(
        transaction,
        "aborted",
        terminalTime(transaction.preparedAt, this.#clock.now()),
      ),
    );
    return [];
  }

  private async reconcileRollbackLocked(
    transaction: RollbackTransactionRecord,
  ): Promise<readonly EngineEvent[]> {
    const subject = await optionalSubject(this.#subjects, transaction.subjectId);
    if (subject === undefined) {
      throw storageCorrupt("Prepared rollback journal references a missing subject.");
    }
    const state = await optionalState(this.#states, transaction.subjectId);
    if (state === undefined) {
      throw storageCorrupt("Prepared rollback journal references a missing subject state.");
    }

    if (state.checksum === transaction.targetState.checksum) {
      return this.materializeRollbackCommitted(transaction, state);
    }
    if (state.checksum !== transaction.previousStateChecksum) {
      throw storageCorrupt(
        "Prepared rollback is neither at its target nor its previous fact state.",
      );
    }
    if (
      state.currentVersionId !== transaction.previousCurrentVersionId ||
      state.suspendedVersionId !== undefined ||
      !samePendingFacts(state.pending, transaction.previousPending) ||
      state.generation !== transaction.targetState.generation ||
      state.materialSetHash !== transaction.targetState.materialSetHash ||
      canonicalJson(state.materialManifest) !==
        canonicalJson(transaction.targetState.materialManifest)
    ) {
      throw storageCorrupt("Previous rollback state does not match its exact journal fields.");
    }
    if (
      transaction.previousPending?.lease !== undefined &&
      transaction.previousPending.lease.expiresAt > transaction.preparedAt
    ) {
      throw storageCorrupt("A rollback journal was prepared while its pending lease was active.");
    }
    const artifacts = await this.validateRollbackJournalSemantics(transaction, "optional");
    const operation = await this.#operations.readOptional(transaction.requestId);
    const events = await Promise.all(
      transaction.events.map((record) =>
        optionalEvent(this.#events, transaction.subjectId, record.eventId),
      ),
    );
    if (operation !== undefined || events.some((event) => event !== undefined)) {
      throw storageCorrupt(
        "A previous-state rollback journal cannot have post-commit operation or event facts.",
      );
    }
    await this.#versionStaging.cleanup(transaction.requestId, artifacts);
    await this.#versionStaging.removePublishedExact(
      transaction.requestId,
      artifacts,
      async (subjectId, versionId) => {
        await this.verifyVersionUnreferencedForCleanup(transaction.requestId, subjectId, versionId);
      },
    );
    await this.#transactions.write(
      terminalRollbackTransaction(
        transaction,
        "aborted",
        terminalTime(transaction.preparedAt, this.#clock.now()),
      ),
    );
    return [];
  }

  /**
   * Proves that a journal-owned version has no durable state, lineage, transaction, or operation
   * reference before exact pre-commit cleanup removes it.
   *
   * This package-internal proof is race-safe only while the owner subject lock is held.
   *
   * @param ownerRequestId - The journal authorized to clean its own unpublished target.
   * @param subjectId - Subject that owns the candidate version directory.
   * @param versionId - Candidate version whose durable references must be absent.
   */
  async verifyVersionUnreferencedForCleanup(
    ownerRequestId: RequestId,
    subjectId: SubjectId,
    versionId: VersionId,
  ): Promise<void> {
    let ownerSeen = false;
    for (const subject of await this.#subjects.listAll()) {
      if (subject.id === subjectId) ownerSeen = true;
      const state = await optionalState(this.#states, subject.id);
      if (state !== undefined && stateReferencesVersion(state, versionId)) {
        throw storageCorrupt("A journal-owned version is still referenced by subject state.");
      }
      for (const event of await this.#events.list(subject.id)) {
        if (eventRecordReferencesVersion(event, versionId)) {
          throw storageCorrupt("A journal-owned version is referenced by durable lineage.");
        }
      }
      for (const historical of await this.#versions.list(subject.id)) {
        if (historical.version.id === versionId) continue;
        if (
          versionReferencesVersion(historical.version, versionId) ||
          historical.claims.versionId === versionId ||
          claimsReferenceVersion(historical.claims.claims, versionId) ||
          profileReferencesVersion(historical.profile, versionId)
        ) {
          throw storageCorrupt("A journal-owned version is referenced by historical lineage.");
        }
      }
    }
    for (const candidate of await this.#transactions.list()) {
      if (candidate.requestId === ownerRequestId) continue;
      if (transactionReferencesVersion(candidate, versionId)) {
        throw storageCorrupt("A journal-owned version is referenced by another transaction.");
      }
    }
    for (const operation of await this.#operations.list()) {
      if (operationReferencesVersion(operation, versionId)) {
        throw storageCorrupt("A journal-owned version is referenced by a completed operation.");
      }
    }
    if (!ownerSeen) {
      throw storageCorrupt("A journal-owned version belongs to a missing subject.");
    }
  }
}
