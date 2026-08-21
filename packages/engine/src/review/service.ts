import {
  DistillyError,
  actorContextSchema,
  engineMethodSchemas,
  mutationContextSchema,
  reviewDecisionTransactionRecordSchema,
  rollbackTransactionRecordSchema,
} from "@distilly/protocol";
import { setTimeout as delay } from "node:timers/promises";
import type {
  ActorContext,
  EngineEvent,
  EventRecord,
  IsoDateTime,
  MutationContext,
  OperationFact,
  OperationRecord,
  PendingJobMarker,
  Profile,
  RequestId,
  ReviewActionInput,
  ReviewDecisionTransactionMethod,
  ReviewDecisionTransactionRecord,
  RollbackInput,
  RollbackTransactionRecord,
  SubjectId,
  SubjectStateRecord,
  VersionClaimsSnapshot,
  VersionId,
  VersionMaterialManifest,
  VersionRecord,
  VersionSummary,
} from "@distilly/protocol";

import type { Clock } from "../defaults/system-clock.js";
import { canonicalJson } from "../facts/canonical-json.js";
import { computeFactChecksum, sealFact } from "../facts/checksum.js";
import type { FileEventStore } from "../facts/event-store.js";
import type { FileMaterialStore } from "../facts/material-store.js";
import type { FileOperationStore } from "../facts/operation-store.js";
import type { FileStateStore } from "../facts/state-store.js";
import type { FileSubjectStore } from "../facts/subject-store.js";
import type { FileTransactionStore } from "../facts/transaction-store.js";
import type {
  FileVersionStore,
  StoredCompleteVersion,
  VersionArtifactSet,
} from "../facts/version-store.js";
import {
  factNotFound,
  idempotencyConflict,
  invalidInput,
  leaseConflict,
  reviewConflict,
  storageCorrupt,
} from "../internal-errors.js";
import type { EventBus } from "../ports/event-bus.js";
import type { IdGenerator } from "../ports/id-generator.js";
import { renderProfile, renderPrompt } from "../profile/render.js";
import { deriveVersionId } from "../profile/version-id.js";
import {
  validateCommittedMaterialSet,
  validateCommittedVersionSet,
  validateRollbackHistoricalCopy,
} from "../read/committed-version-reader.js";
import type { FileRequestLock } from "../transaction/request-lock.js";
import type { FileLockLease } from "../transaction/file-lock.js";
import type { RecoveryService } from "../transaction/recovery.js";
import {
  validateReviewTransactionTarget,
  validateRollbackTransactionTarget,
} from "../transaction/recovery.js";
import type { FileSubjectLock } from "../transaction/subject-lock.js";
import type { FileVersionStaging } from "../transaction/version-staging.js";

interface ReviewOutcome {
  readonly result: VersionSummary;
  readonly events: readonly EngineEvent[];
}

/** Fault-injection seams for review-decision and rollback crash matrices. */
export interface ReviewServiceHooks {
  readonly afterPrepared?: (
    transaction: ReviewDecisionTransactionRecord | RollbackTransactionRecord,
  ) => void | Promise<void>;
  readonly afterVersionPrepared?: (transaction: RollbackTransactionRecord) => void | Promise<void>;
  readonly afterVersionPublished?: (transaction: RollbackTransactionRecord) => void | Promise<void>;
  readonly afterFactCommit?: (
    transaction: ReviewDecisionTransactionRecord | RollbackTransactionRecord,
  ) => void | Promise<void>;
}

/** Concrete facts, locks, projections, and deterministic seams used by review writes. */
export interface ReviewServiceDependencies {
  readonly subjects: FileSubjectStore;
  readonly states: FileStateStore;
  readonly materials: FileMaterialStore;
  readonly versions: FileVersionStore;
  readonly versionStaging: FileVersionStaging;
  readonly operations: FileOperationStore;
  readonly transactions: FileTransactionStore;
  readonly events: FileEventStore;
  readonly requestLocks: FileRequestLock;
  readonly subjectLocks: FileSubjectLock;
  readonly recovery: RecoveryService;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly eventBus: EventBus;
  readonly hooks?: ReviewServiceHooks;
}

const parseBoundary = <T>(parse: () => T, fieldPath: string): T => {
  try {
    return parse();
  } catch (error) {
    if (error instanceof DistillyError) throw error;
    throw invalidInput("The review mutation boundary input is invalid.", fieldPath);
  }
};

const actorEquals = (left: ActorContext, right: ActorContext): boolean =>
  canonicalJson(left) === canonicalJson(right);

const sameOptionalFact = <T>(left: T | undefined, right: T | undefined): boolean =>
  left === undefined || right === undefined
    ? left === right
    : canonicalJson(left) === canonicalJson(right);

const requiredState = async (
  states: FileStateStore,
  subjectId: SubjectId,
): Promise<SubjectStateRecord> => {
  try {
    return await states.read(subjectId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") {
      throw storageCorrupt("A review target is missing its authoritative state.", error);
    }
    throw error;
  }
};

const requiredVersion = async (
  versions: FileVersionStore,
  subjectId: SubjectId,
  versionId: VersionId,
): Promise<StoredCompleteVersion> => {
  try {
    return await versions.read(subjectId, versionId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") {
      throw storageCorrupt("The active review candidate is missing its immutable facts.", error);
    }
    throw error;
  }
};

const summarizeVersion = (
  version: VersionRecord,
  status: "current" | "rejected",
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

const replayOperation = (
  operation: OperationFact,
  inputChecksum: OperationRecord["inputChecksum"],
  method: "versions.promote" | "versions.reject" | "versions.rollback",
): VersionSummary => {
  if (operation.method !== method || operation.inputChecksum !== inputChecksum) {
    throw idempotencyConflict("RequestId was already used by a different mutation input.");
  }
  if (operation.recordKind === "tombstone") {
    throw factNotFound("The subject previously owned by this request was purged.");
  }
  return operation.result;
};

const manifestDelta = (state: SubjectStateRecord, baseline: VersionMaterialManifest): number => {
  const authoritative = new Map(
    state.materialManifest.map((entry) => [entry.materialId, entry] as const),
  );
  for (const entry of baseline.items) {
    const current = authoritative.get(entry.materialId);
    if (
      current === undefined ||
      current.contentDigest !== entry.contentDigest ||
      current.provenanceDigest !== entry.provenanceDigest
    ) {
      throw storageCorrupt("A review baseline is not an exact subset of authoritative materials.");
    }
  }
  return state.materialManifest.length - baseline.items.length;
};

const rebasePending = (
  state: SubjectStateRecord,
  baseline: VersionMaterialManifest,
  baseVersionId: VersionId,
  now: IsoDateTime,
  ids: IdGenerator,
): PendingJobMarker | undefined => {
  const delta = manifestDelta(state, baseline);
  if (state.pending === undefined || delta === 0) return undefined;
  if (state.materialSetHash === undefined) {
    throw storageCorrupt("A versioned subject is missing its authoritative material-set hash.");
  }
  return {
    jobId: ids.jobId(),
    generation: state.generation,
    baseVersionId,
    materialSetHash: state.materialSetHash,
    addedMaterialCount: delta,
    totalMaterialCount: state.materialManifest.length,
    queuedAt: now,
  };
};

const targetState = (
  previous: SubjectStateRecord,
  currentVersionId: VersionId | undefined,
  pending: PendingJobMarker | undefined,
): SubjectStateRecord =>
  sealFact<SubjectStateRecord>({
    schemaVersion: 2,
    subjectId: previous.subjectId,
    generation: previous.generation,
    ...(previous.materialSetHash === undefined
      ? {}
      : { materialSetHash: previous.materialSetHash }),
    materialManifest: previous.materialManifest,
    ...(currentVersionId === undefined ? {} : { currentVersionId }),
    ...(pending === undefined ? {} : { pending }),
  });

const makeEvent = (
  kind: "version.promoted" | "version.rejected" | "version.rolled_back" | "job.changed",
  subjectId: SubjectId,
  versionId: VersionId | undefined,
  at: IsoDateTime,
  actor: ActorContext,
  requestId: RequestId,
  ids: IdGenerator,
  reason?: string,
  relatedVersionId?: VersionId,
): EventRecord =>
  sealFact<EventRecord>({
    schemaVersion: 1,
    eventId: ids.eventId(),
    event: {
      kind,
      subjectId,
      ...(versionId === undefined ? {} : { versionId }),
      at,
    },
    actor,
    requestId,
    ...(reason === undefined ? {} : { reason }),
    ...(relatedVersionId === undefined ? {} : { relatedVersionId }),
  });

const preparedReviewTransaction = (input: {
  readonly method: ReviewDecisionTransactionMethod;
  readonly requestId: RequestId;
  readonly previous: SubjectStateRecord;
  readonly candidateVersionId: VersionId;
  readonly target: SubjectStateRecord;
  readonly operation: OperationRecord<"versions.promote" | "versions.reject">;
  readonly events: readonly [EventRecord] | readonly [EventRecord, EventRecord];
  readonly preparedAt: IsoDateTime;
}): ReviewDecisionTransactionRecord => {
  if (input.previous.suspendedVersionId === undefined) {
    throw storageCorrupt("A prepared review transaction requires a suspended candidate.");
  }
  const payload = {
    schemaVersion: 1,
    transactionKind: "review_decision",
    method: input.method,
    requestId: input.requestId,
    subjectId: input.previous.subjectId,
    candidateVersionId: input.candidateVersionId,
    previousStateChecksum: input.previous.checksum,
    ...(input.previous.currentVersionId === undefined
      ? {}
      : { previousCurrentVersionId: input.previous.currentVersionId }),
    previousSuspendedVersionId: input.previous.suspendedVersionId,
    ...(input.previous.pending === undefined ? {} : { previousPending: input.previous.pending }),
    targetState: input.target,
    operation: input.operation,
    events: input.events,
    preparedAt: input.preparedAt,
    state: "prepared",
  } as const;
  try {
    return reviewDecisionTransactionRecordSchema.parse({
      ...payload,
      checksum: computeFactChecksum(payload),
    }) as ReviewDecisionTransactionRecord;
  } catch (error) {
    throw storageCorrupt("Prepared review payload violates its persisted contract.", error);
  }
};

const repreparedReviewTransaction = (
  transaction: ReviewDecisionTransactionRecord,
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
    state: "prepared",
  } as const;
  return reviewDecisionTransactionRecordSchema.parse({
    ...payload,
    checksum: computeFactChecksum(payload),
  }) as ReviewDecisionTransactionRecord;
};

const preparedRollbackTransaction = (input: {
  readonly requestId: RequestId;
  readonly targetVersionId: VersionId;
  readonly previous: SubjectStateRecord;
  readonly target: SubjectStateRecord;
  readonly artifacts: VersionArtifactSet;
  readonly operation: OperationRecord<"versions.rollback">;
  readonly events: readonly [EventRecord] | readonly [EventRecord, EventRecord];
  readonly preparedAt: IsoDateTime;
}): RollbackTransactionRecord => {
  if (input.previous.currentVersionId === undefined) {
    throw storageCorrupt("A prepared rollback transaction requires a previous current version.");
  }
  const payload = {
    schemaVersion: 1,
    transactionKind: "rollback",
    requestId: input.requestId,
    subjectId: input.previous.subjectId,
    targetVersionId: input.targetVersionId,
    previousStateChecksum: input.previous.checksum,
    previousCurrentVersionId: input.previous.currentVersionId,
    ...(input.previous.pending === undefined ? {} : { previousPending: input.previous.pending }),
    targetState: input.target,
    version: input.artifacts.version,
    materialManifest: input.artifacts.manifest,
    claims: input.artifacts.claims,
    profile: input.artifacts.profile,
    prompt: input.artifacts.prompt,
    operation: input.operation,
    events: input.events,
    preparedAt: input.preparedAt,
    state: "prepared",
  } as const;
  try {
    return rollbackTransactionRecordSchema.parse({
      ...payload,
      checksum: computeFactChecksum(payload),
    }) as RollbackTransactionRecord;
  } catch (error) {
    throw storageCorrupt("Prepared rollback payload violates its persisted contract.", error);
  }
};

const repreparedRollbackTransaction = (
  transaction: RollbackTransactionRecord,
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
    state: "prepared",
  } as const;
  return rollbackTransactionRecordSchema.parse({
    ...payload,
    checksum: computeFactChecksum(payload),
  }) as RollbackTransactionRecord;
};

/** Package-internal coordinator for candidate decisions and historical rollback. */
export class ReviewService {
  readonly #dependencies: ReviewServiceDependencies;

  /**
   * Creates review mutations over authoritative facts and recovery seams.
   *
   * @param dependencies - Concrete stores, locks, deterministic seams, and projections.
   */
  constructor(dependencies: ReviewServiceDependencies) {
    this.#dependencies = dependencies;
  }

  /**
   * Promotes the exact active suspended candidate.
   *
   * @param rawInput - Untrusted candidate decision input.
   * @param rawActor - Actor persisted with the operation and lineage event.
   * @param rawContext - Idempotency context for the mutation.
   * @returns The promoted current-version summary.
   */
  async promote(
    rawInput: ReviewActionInput,
    rawActor: ActorContext,
    rawContext: MutationContext,
  ): Promise<VersionSummary> {
    return this.decide("promote", rawInput, rawActor, rawContext);
  }

  /**
   * Rejects the exact active suspended candidate.
   *
   * @param rawInput - Untrusted candidate decision input.
   * @param rawActor - Actor persisted with the operation and lineage event.
   * @param rawContext - Idempotency context for the mutation.
   * @returns The rejected candidate summary.
   */
  async reject(
    rawInput: ReviewActionInput,
    rawActor: ActorContext,
    rawContext: MutationContext,
  ): Promise<VersionSummary> {
    return this.decide("reject", rawInput, rawActor, rawContext);
  }

  /**
   * Copies one eligible historical version into a new immutable current version.
   *
   * @param rawInput - Untrusted historical rollback target and required reason.
   * @param rawActor - Actor persisted with the new immutable version and lineage event.
   * @param rawContext - Idempotency context for the mutation.
   * @returns The newly created current-version summary.
   */
  async rollback(
    rawInput: RollbackInput,
    rawActor: ActorContext,
    rawContext: MutationContext,
  ): Promise<VersionSummary> {
    const input = parseBoundary(
      () => engineMethodSchemas["versions.rollback"].params.parse(rawInput),
      "params",
    );
    const actor = parseBoundary(() => actorContextSchema.parse(rawActor) as ActorContext, "actor");
    const context = parseBoundary(
      () => mutationContextSchema.parse(rawContext) as MutationContext,
      "requestId",
    );
    const inputChecksum = computeFactChecksum({
      method: "versions.rollback",
      params: input,
      actor,
    });

    for (;;) {
      await this.reconcilePrepared();
      const requestLease = await this.#dependencies.requestLocks.acquire(context.requestId);
      let outcome: ReviewOutcome | undefined;
      let reconcileRequestId: RequestId | undefined;
      try {
        const operation = await this.#dependencies.operations.readOptional(context.requestId);
        const journal = await this.#dependencies.transactions.readOptional(context.requestId);
        if (journal !== undefined) {
          if (
            journal.transactionKind !== "rollback" ||
            journal.operation.inputChecksum !== inputChecksum ||
            !actorEquals(journal.operation.actor, actor)
          ) {
            throw idempotencyConflict("RequestId was already used by a different mutation input.");
          }
          if (journal.state === "prepared") {
            reconcileRequestId = context.requestId;
          } else if (journal.state === "committed") {
            validateRollbackTransactionTarget(journal, journal.targetState);
            await this.#dependencies.recovery.validateRollbackJournalSemantics(journal);
            if (
              operation === undefined ||
              (operation.recordKind === "completed" &&
                operation.checksum !== journal.operation.checksum)
            ) {
              throw storageCorrupt(
                "A committed rollback journal disagrees with its operation fact.",
              );
            }
          } else if (operation !== undefined) {
            throw storageCorrupt("An aborted rollback journal cannot have an operation fact.");
          }
        }
        if (reconcileRequestId === undefined && operation !== undefined) {
          if (
            journal === undefined &&
            operation.recordKind === "completed" &&
            operation.method === "versions.rollback"
          ) {
            throw storageCorrupt("A completed rollback operation is missing its terminal journal.");
          }
          return replayOperation(operation, inputChecksum, "versions.rollback");
        }

        if (reconcileRequestId === undefined) {
          const subjectLease = await this.acquireSubject(input.subjectId);
          try {
            const otherPrepared = (await this.#dependencies.transactions.list()).find(
              (transaction) =>
                transaction.requestId !== context.requestId &&
                transaction.state === "prepared" &&
                transaction.subjectId === input.subjectId,
            );
            if (otherPrepared !== undefined) {
              reconcileRequestId = otherPrepared.requestId;
            } else {
              const now = this.#dependencies.clock.now();
              const state = await requiredState(this.#dependencies.states, input.subjectId);
              await this.validateCommittedVersions(state);
              outcome =
                journal?.transactionKind === "rollback"
                  ? await this.resumeRollback(journal, state, now)
                  : await this.prepareRollback(input, actor, context, inputChecksum, state, now);
            }
          } finally {
            await subjectLease.release();
          }
        }
      } finally {
        await requestLease.release();
      }

      if (reconcileRequestId !== undefined) {
        await this.#dependencies.recovery.reconcile(reconcileRequestId);
        continue;
      }
      if (outcome === undefined) {
        throw storageCorrupt("A rollback mutation ended without a result or recovery target.");
      }
      for (const event of outcome.events) await this.#dependencies.eventBus.publish(event);
      return outcome.result;
    }
  }

  private async decide(
    method: ReviewDecisionTransactionMethod,
    rawInput: ReviewActionInput,
    rawActor: ActorContext,
    rawContext: MutationContext,
  ): Promise<VersionSummary> {
    const engineMethod = `versions.${method}` as const;
    const input = parseBoundary(
      () => engineMethodSchemas[engineMethod].params.parse(rawInput),
      "params",
    );
    const actor = parseBoundary(() => actorContextSchema.parse(rawActor) as ActorContext, "actor");
    const context = parseBoundary(
      () => mutationContextSchema.parse(rawContext) as MutationContext,
      "requestId",
    );
    const inputChecksum = computeFactChecksum({ method: engineMethod, params: input, actor });

    for (;;) {
      await this.reconcilePrepared();
      const requestLease = await this.#dependencies.requestLocks.acquire(context.requestId);
      let outcome: ReviewOutcome | undefined;
      let reconcileRequestId: RequestId | undefined;
      try {
        const operation = await this.#dependencies.operations.readOptional(context.requestId);
        const journal = await this.#dependencies.transactions.readOptional(context.requestId);
        if (journal !== undefined) {
          if (
            journal.transactionKind !== "review_decision" ||
            journal.method !== method ||
            journal.operation.inputChecksum !== inputChecksum ||
            !actorEquals(journal.operation.actor, actor)
          ) {
            throw idempotencyConflict("RequestId was already used by a different mutation input.");
          }
          if (journal.state === "prepared") {
            reconcileRequestId = context.requestId;
          } else if (journal.state === "committed") {
            validateReviewTransactionTarget(journal, journal.targetState);
            await this.#dependencies.recovery.validateReviewJournalSemantics(journal);
            if (
              operation === undefined ||
              (operation.recordKind === "completed" &&
                operation.checksum !== journal.operation.checksum)
            ) {
              throw storageCorrupt("A committed review journal disagrees with its operation fact.");
            }
          } else if (operation !== undefined) {
            throw storageCorrupt("An aborted review journal cannot have an operation fact.");
          }
        }
        if (reconcileRequestId === undefined && operation !== undefined) {
          if (
            journal === undefined &&
            operation.recordKind === "completed" &&
            operation.method === engineMethod
          ) {
            throw storageCorrupt("A completed review operation is missing its terminal journal.");
          }
          return replayOperation(operation, inputChecksum, engineMethod);
        }

        if (reconcileRequestId === undefined) {
          const subjectLease = await this.acquireSubject(input.subjectId);
          try {
            const otherPrepared = (await this.#dependencies.transactions.list()).find(
              (transaction) =>
                transaction.requestId !== context.requestId &&
                transaction.state === "prepared" &&
                transaction.subjectId === input.subjectId,
            );
            if (otherPrepared !== undefined) {
              reconcileRequestId = otherPrepared.requestId;
            } else {
              const now = this.#dependencies.clock.now();
              const state = await requiredState(this.#dependencies.states, input.subjectId);
              await this.validateCommittedVersions(state);
              outcome =
                journal?.transactionKind === "review_decision"
                  ? await this.resumeDecision(journal, state)
                  : await this.prepareDecision(
                      method,
                      input,
                      actor,
                      context,
                      inputChecksum,
                      state,
                      now,
                    );
            }
          } finally {
            await subjectLease.release();
          }
        }
      } finally {
        await requestLease.release();
      }

      if (reconcileRequestId !== undefined) {
        await this.#dependencies.recovery.reconcile(reconcileRequestId);
        continue;
      }
      if (outcome === undefined) {
        throw storageCorrupt("A review mutation ended without a result or recovery target.");
      }
      for (const event of outcome.events) await this.#dependencies.eventBus.publish(event);
      return outcome.result;
    }
  }

  private async prepareDecision(
    method: ReviewDecisionTransactionMethod,
    input: ReviewActionInput,
    actor: ActorContext,
    context: MutationContext,
    inputChecksum: OperationRecord["inputChecksum"],
    previous: SubjectStateRecord,
    now: IsoDateTime,
  ): Promise<ReviewOutcome> {
    if (previous.suspendedVersionId !== input.candidateVersionId) {
      throw reviewConflict("The requested candidate is no longer the active suspended version.");
    }
    const candidate = await requiredVersion(
      this.#dependencies.versions,
      previous.subjectId,
      input.candidateVersionId,
    );
    if (
      candidate.version.createdDisposition !== "suspended" ||
      candidate.version.reviewReasons === undefined ||
      candidate.version.parentId !== previous.currentVersionId
    ) {
      throw storageCorrupt("The active review candidate does not match its current parent.");
    }

    const pending =
      method === "reject"
        ? previous.pending
        : rebasePending(
            previous,
            candidate.manifest,
            candidate.version.id,
            now,
            this.#dependencies.ids,
          );
    const target = targetState(
      previous,
      method === "promote" ? candidate.version.id : previous.currentVersionId,
      pending,
    );
    const result = summarizeVersion(
      candidate.version,
      method === "promote" ? "current" : "rejected",
    );
    const engineMethod = `versions.${method}` as const;
    const operation = sealFact<OperationRecord<typeof engineMethod>>({
      schemaVersion: 1,
      recordKind: "completed",
      requestId: context.requestId,
      method: engineMethod,
      scope: { kind: "subject", subjectId: previous.subjectId },
      actor,
      inputChecksum,
      result,
      completedAt: now,
    });
    const decisionEvent = makeEvent(
      method === "promote" ? "version.promoted" : "version.rejected",
      previous.subjectId,
      candidate.version.id,
      now,
      actor,
      context.requestId,
      this.#dependencies.ids,
      input.reason,
    );
    const pendingChanged = !sameOptionalFact(previous.pending, pending);
    const events = pendingChanged
      ? ([
          decisionEvent,
          makeEvent(
            "job.changed",
            previous.subjectId,
            undefined,
            now,
            actor,
            context.requestId,
            this.#dependencies.ids,
          ),
        ] as const)
      : ([decisionEvent] as const);
    const transaction = preparedReviewTransaction({
      method,
      requestId: context.requestId,
      previous,
      candidateVersionId: candidate.version.id,
      target,
      operation,
      events,
      preparedAt: now,
    });
    return this.commitDecisionLocked(transaction);
  }

  private async resumeDecision(
    terminal: ReviewDecisionTransactionRecord,
    current: SubjectStateRecord,
  ): Promise<ReviewOutcome> {
    if (terminal.state !== "aborted") {
      throw storageCorrupt("Only an aborted review journal can be reprepared.");
    }
    if (
      current.checksum !== terminal.previousStateChecksum ||
      current.currentVersionId !== terminal.previousCurrentVersionId ||
      current.suspendedVersionId !== terminal.previousSuspendedVersionId ||
      !sameOptionalFact(current.pending, terminal.previousPending)
    ) {
      throw reviewConflict("The aborted review no longer matches the active candidate state.");
    }
    await this.#dependencies.recovery.validateReviewJournalSemantics(terminal);
    const prepared = repreparedReviewTransaction(terminal);
    return this.commitDecisionLocked(prepared);
  }

  private async commitDecisionLocked(
    transaction: ReviewDecisionTransactionRecord,
  ): Promise<ReviewOutcome> {
    validateReviewTransactionTarget(transaction, transaction.targetState);
    await this.#dependencies.transactions.write(transaction);
    await this.#dependencies.hooks?.afterPrepared?.(transaction);
    const current = await requiredState(this.#dependencies.states, transaction.subjectId);
    if (
      current.checksum !== transaction.targetState.checksum ||
      canonicalJson(current) !== canonicalJson(transaction.targetState)
    ) {
      if (current.checksum !== transaction.previousStateChecksum) {
        throw storageCorrupt("A prepared review encountered a third authoritative state.");
      }
      await this.#dependencies.states.write(transaction.targetState);
    }
    await this.#dependencies.hooks?.afterFactCommit?.(transaction);
    const events = await this.#dependencies.recovery.materializeReviewCommitted(
      transaction,
      transaction.targetState,
    );
    return { result: transaction.operation.result, events };
  }

  private async prepareRollback(
    input: RollbackInput,
    actor: ActorContext,
    context: MutationContext,
    inputChecksum: OperationRecord["inputChecksum"],
    previous: SubjectStateRecord,
    now: IsoDateTime,
  ): Promise<ReviewOutcome> {
    if (previous.suspendedVersionId !== undefined) throw reviewConflict();
    if (previous.pending?.lease !== undefined && previous.pending.lease.expiresAt > now) {
      throw leaseConflict("Rollback requires the active distillation lease to expire or release.");
    }
    if (previous.currentVersionId === undefined) {
      throw invalidInput("Rollback requires an existing current version.", "targetVersionId");
    }
    if (input.targetVersionId === previous.currentVersionId) {
      throw invalidInput("Rollback target must be historical, not current.", "targetVersionId");
    }
    const source = await this.findRollbackSource(previous.subjectId, input.targetVersionId);
    if (await this.isRejected(previous.subjectId, input.targetVersionId)) {
      throw invalidInput("Rejected versions are not eligible rollback targets.", "targetVersionId");
    }
    const artifacts = this.makeRollbackArtifacts(source, previous.currentVersionId, actor, now);
    const [versions, durableEvents] = await Promise.all([
      this.#dependencies.versions.list(previous.subjectId),
      this.#dependencies.events.list(previous.subjectId),
    ]);
    validateRollbackHistoricalCopy(
      artifacts,
      new Map(versions.map((stored) => [stored.version.id, stored] as const)),
      durableEvents,
    );
    const pending = rebasePending(
      previous,
      source.manifest,
      artifacts.version.id,
      now,
      this.#dependencies.ids,
    );
    const target = targetState(previous, artifacts.version.id, pending);
    const result = summarizeVersion(artifacts.version, "current");
    const operation = sealFact<OperationRecord<"versions.rollback">>({
      schemaVersion: 1,
      recordKind: "completed",
      requestId: context.requestId,
      method: "versions.rollback",
      scope: { kind: "subject", subjectId: previous.subjectId },
      actor,
      inputChecksum,
      result,
      completedAt: now,
    });
    const rollbackEvent = makeEvent(
      "version.rolled_back",
      previous.subjectId,
      artifacts.version.id,
      now,
      actor,
      context.requestId,
      this.#dependencies.ids,
      input.reason,
      input.targetVersionId,
    );
    const pendingChanged = !sameOptionalFact(previous.pending, pending);
    const events = pendingChanged
      ? ([
          rollbackEvent,
          makeEvent(
            "job.changed",
            previous.subjectId,
            undefined,
            now,
            actor,
            context.requestId,
            this.#dependencies.ids,
          ),
        ] as const)
      : ([rollbackEvent] as const);
    const transaction = preparedRollbackTransaction({
      requestId: context.requestId,
      targetVersionId: input.targetVersionId,
      previous,
      target,
      artifacts,
      operation,
      events,
      preparedAt: now,
    });
    return this.commitRollbackLocked(transaction);
  }

  private deriveRollbackVersionId(
    source: StoredCompleteVersion,
    parentId: VersionId,
    actor: ActorContext,
  ): VersionId {
    return deriveVersionId(
      {
        subjectId: source.version.subjectId,
        subjectDisplayName: source.version.subjectDisplayName,
        generation: source.version.generation,
        materialSetHash: source.version.materialSetHash,
        parentId,
        creation: { kind: "rollback", targetVersionId: source.version.id },
        actor,
        createdDisposition: "current",
        rendererVersion: source.version.rendererVersion,
        quality: source.version.quality,
      },
      source.claims.claims,
    );
  }

  private makeRollbackArtifacts(
    source: StoredCompleteVersion,
    parentId: VersionId,
    actor: ActorContext,
    now: IsoDateTime,
  ): VersionArtifactSet {
    const versionId = this.deriveRollbackVersionId(source, parentId, actor);
    const version = sealFact<VersionRecord>({
      schemaVersion: 1,
      id: versionId,
      subjectId: source.version.subjectId,
      subjectDisplayName: source.version.subjectDisplayName,
      parentId,
      generation: source.version.generation,
      materialSetHash: source.version.materialSetHash,
      materialCount: source.version.materialCount,
      creation: { kind: "rollback", targetVersionId: source.version.id },
      createdDisposition: "current",
      actor,
      quality: source.version.quality,
      rendererVersion: source.version.rendererVersion,
      createdAt: now,
    });
    const claims = sealFact<VersionClaimsSnapshot>({
      schemaVersion: 1,
      subjectId: source.version.subjectId,
      versionId,
      claims: source.claims.claims,
    });
    const rendered = renderProfile({
      subjectId: source.version.subjectId,
      displayName: source.version.subjectDisplayName,
      versionId,
      claims: source.claims.claims,
      quality: source.version.quality,
    });
    const profile: Profile = {
      subjectId: source.version.subjectId,
      displayName: source.version.subjectDisplayName,
      versionId,
      claims: source.claims.claims,
      core: rendered.core,
      domains: rendered.domains,
      rendered: rendered.markdown,
      quality: source.version.quality,
    };
    return {
      version,
      manifest: source.manifest,
      claims,
      profile,
      prompt: renderPrompt(profile),
    };
  }

  private async resumeRollback(
    terminal: RollbackTransactionRecord,
    current: SubjectStateRecord,
    now: IsoDateTime,
  ): Promise<ReviewOutcome> {
    if (terminal.state !== "aborted") {
      throw storageCorrupt("Only an aborted rollback journal can be reprepared.");
    }
    if (current.suspendedVersionId !== undefined) throw reviewConflict();
    if (current.pending?.lease !== undefined && current.pending.lease.expiresAt > now) {
      throw leaseConflict("Rollback requires the active distillation lease to expire or release.");
    }
    if (
      current.checksum !== terminal.previousStateChecksum ||
      current.currentVersionId !== terminal.previousCurrentVersionId ||
      !sameOptionalFact(current.pending, terminal.previousPending)
    ) {
      throw invalidInput(
        "The aborted rollback no longer matches its previous authoritative state.",
        "targetVersionId",
      );
    }
    await this.#dependencies.recovery.validateRollbackJournalSemantics(terminal, "absent");
    const prepared = repreparedRollbackTransaction(terminal);
    return this.commitRollbackLocked(prepared);
  }

  private async commitRollbackLocked(
    transaction: RollbackTransactionRecord,
  ): Promise<ReviewOutcome> {
    const artifacts = validateRollbackTransactionTarget(transaction, transaction.targetState);
    await this.#dependencies.transactions.write(transaction);
    await this.#dependencies.hooks?.afterPrepared?.(transaction);
    await this.#dependencies.versionStaging.prepare(transaction.requestId, artifacts);
    await this.#dependencies.hooks?.afterVersionPrepared?.(transaction);
    await this.#dependencies.versionStaging.publish(transaction.requestId, artifacts);
    await this.#dependencies.hooks?.afterVersionPublished?.(transaction);
    const current = await requiredState(this.#dependencies.states, transaction.subjectId);
    if (
      current.checksum !== transaction.targetState.checksum ||
      canonicalJson(current) !== canonicalJson(transaction.targetState)
    ) {
      if (current.checksum !== transaction.previousStateChecksum) {
        throw storageCorrupt("A prepared rollback encountered a third authoritative state.");
      }
      await this.#dependencies.states.write(transaction.targetState);
    }
    await this.#dependencies.hooks?.afterFactCommit?.(transaction);
    const events = await this.#dependencies.recovery.materializeRollbackCommitted(
      transaction,
      transaction.targetState,
    );
    return { result: transaction.operation.result, events };
  }

  private async findRollbackSource(
    subjectId: SubjectId,
    targetVersionId: VersionId,
  ): Promise<StoredCompleteVersion> {
    const local = (await this.#dependencies.versions.list(subjectId)).find(
      (version) => version.version.id === targetVersionId,
    );
    if (local !== undefined) return local;
    for (const subject of await this.#dependencies.subjects.listAll()) {
      if (subject.id === subjectId) continue;
      const foreign = (await this.#dependencies.versions.list(subject.id)).some(
        (version) => version.version.id === targetVersionId,
      );
      if (foreign) {
        throw invalidInput("Rollback target belongs to a different subject.", "targetVersionId");
      }
    }
    throw factNotFound("Rollback target version does not exist for this subject.");
  }

  private async isRejected(subjectId: SubjectId, versionId: VersionId): Promise<boolean> {
    return (await this.#dependencies.events.list(subjectId)).some(
      (record) => record.event.kind === "version.rejected" && record.event.versionId === versionId,
    );
  }

  private async validateCommittedVersions(state: SubjectStateRecord): Promise<void> {
    const [materials, versions, events] = await Promise.all([
      this.#dependencies.materials.list(state.subjectId),
      this.#dependencies.versions.list(state.subjectId),
      this.#dependencies.events.list(state.subjectId),
    ]);
    validateCommittedVersionSet(state.subjectId, state, versions, events);
    validateCommittedMaterialSet(state, versions, materials);
  }

  private async acquireSubject(subjectId: SubjectId): Promise<FileLockLease> {
    return this.retryBusy(() => this.#dependencies.subjectLocks.acquire(subjectId));
  }

  private async reconcilePrepared(): Promise<void> {
    await this.retryBusy(() => this.#dependencies.recovery.reconcilePending());
  }

  private async retryBusy<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await operation();
      } catch (error) {
        if (!(error instanceof DistillyError) || error.code !== "busy" || attempt >= 499) {
          throw error;
        }
        await delay(10);
      }
    }
  }
}
