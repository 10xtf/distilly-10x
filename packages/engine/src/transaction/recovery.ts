import { DistillyError, transactionRecordSchema } from "@distilly/protocol";
import type {
  EngineEvent,
  IngestTransactionRecord,
  IsoDateTime,
  RequestId,
  SubjectRecord,
  SubjectStateRecord,
} from "@distilly/protocol";

import type { Clock } from "../defaults/system-clock.js";
import type { FileEventStore } from "../facts/event-store.js";
import type { FileMaterialStore } from "../facts/material-store.js";
import type { FileOperationStore } from "../facts/operation-store.js";
import type { FileSpaceStore } from "../facts/space-store.js";
import { computeFactChecksum } from "../facts/checksum.js";
import { canonicalJson } from "../facts/canonical-json.js";
import type { FileStateStore } from "../facts/state-store.js";
import type { FileSubjectStore } from "../facts/subject-store.js";
import type { FileTransactionStore } from "../facts/transaction-store.js";
import { storageCorrupt } from "../internal-errors.js";
import type { EventBus } from "../ports/event-bus.js";
import type { SqliteQueueProjection } from "../queue/sqlite-projection.js";
import type { FileIngestStaging } from "./ingest-staging.js";
import type { FileRequestLock } from "./request-lock.js";
import type { FileSpaceIdentityLock } from "./space-identity-lock.js";
import type { FileSubjectLock } from "./subject-lock.js";
import { summarizeSubject } from "../subject/service.js";

/** Fault-injection hooks for idempotent post-commit recovery tests. */
export interface RecoveryHooks {
  /** Runs after the immutable completed operation is durable. */
  readonly afterOperation?: () => void | Promise<void>;
  /** Runs after one immutable event is durable. */
  readonly afterEvent?: (
    eventId: IngestTransactionRecord["events"][number]["eventId"],
  ) => void | Promise<void>;
  /** Runs after the queue projection is durable and clean. */
  readonly afterQueue?: () => void | Promise<void>;
}

const optionalSubject = async (
  store: FileSubjectStore,
  request: IngestTransactionRecord,
): Promise<SubjectRecord | undefined> => {
  try {
    return await store.read(request.subjectId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") return undefined;
    throw error;
  }
};

const optionalState = async (
  store: FileStateStore,
  request: IngestTransactionRecord,
): Promise<SubjectStateRecord | undefined> => {
  try {
    return await store.read(request.subjectId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") return undefined;
    throw error;
  }
};

const terminalTransaction = (
  transaction: IngestTransactionRecord,
  state: "committed" | "aborted",
  finishedAt: IsoDateTime,
): IngestTransactionRecord => {
  const common = {
    schemaVersion: 1,
    transactionKind: "ingest",
    requestId: transaction.requestId,
    spaceId: transaction.spaceId,
    subjectId: transaction.subjectId,
    targetStateChecksum: transaction.targetStateChecksum,
    newMaterials: transaction.newMaterials,
    operation: transaction.operation,
    events: transaction.events,
    preparedAt: transaction.preparedAt,
    ...(transaction.createdSubject
      ? {
          createdSubject: true,
          targetSubjectChecksum: transaction.targetSubjectChecksum,
        }
      : {
          createdSubject: false,
          previousStateChecksum: transaction.previousStateChecksum,
        }),
    finishedAt,
  } as const;
  const payload = { ...common, state };
  return transactionRecordSchema.parse({
    ...payload,
    checksum: computeFactChecksum(payload),
  }) as IngestTransactionRecord;
};

const assertTargetState = (
  transaction: IngestTransactionRecord,
  state: SubjectStateRecord,
): void => {
  if (
    state.subjectId !== transaction.subjectId ||
    state.generation !== transaction.operation.result.generation ||
    state.materialSetHash !== transaction.operation.result.materialSetHash
  ) {
    throw storageCorrupt("Recovered state does not match the stored ingest result.");
  }

  const byId = new Map(state.materialManifest.map((entry) => [entry.materialId, entry]));
  for (const item of transaction.operation.result.items) {
    const target = byId.get(item.materialId);
    if (target === undefined || target.contentDigest !== item.contentDigest) {
      throw storageCorrupt("Recovered ingest result references material outside its target state.");
    }
  }
  for (const entry of transaction.newMaterials) {
    const target = byId.get(entry.materialId);
    if (
      target === undefined ||
      target.contentDigest !== entry.contentDigest ||
      target.provenanceDigest !== entry.provenanceDigest
    ) {
      throw storageCorrupt("Recovered state is missing a journal-owned material.");
    }
  }
  if (
    transaction.createdSubject &&
    state.materialManifest.length !== transaction.newMaterials.length
  ) {
    throw storageCorrupt("A newly created subject contains material outside its ingest journal.");
  }

  const job = transaction.operation.result.job;
  const pending = state.pending;
  if ((job === undefined) !== (pending === undefined)) {
    throw storageCorrupt("Recovered pending state does not match the stored ingest result.");
  }
  if (
    job !== undefined &&
    pending !== undefined &&
    (job.id !== pending.jobId ||
      job.subjectId !== state.subjectId ||
      job.generation !== pending.generation ||
      job.baseVersionId !== pending.baseVersionId ||
      job.materialSetHash !== pending.materialSetHash ||
      job.addedMaterialCount !== pending.addedMaterialCount ||
      job.totalMaterialCount !== pending.totalMaterialCount ||
      job.state !== "pending" ||
      job.queuedAt !== pending.queuedAt ||
      job.leaseExpiresAt !== undefined ||
      job.failure !== undefined)
  ) {
    throw storageCorrupt("Recovered pending marker does not match the stored ingest job.");
  }
};

/** Concrete stores, locks, projection, and trusted seams used by recovery. */
export interface RecoveryDependencies {
  readonly transactions: FileTransactionStore;
  readonly operations: FileOperationStore;
  readonly spaces: FileSpaceStore;
  readonly subjects: FileSubjectStore;
  readonly states: FileStateStore;
  readonly materials: FileMaterialStore;
  readonly events: FileEventStore;
  readonly staging: FileIngestStaging;
  readonly requestLocks: FileRequestLock;
  readonly spaceIdentityLocks: FileSpaceIdentityLock;
  readonly subjectLocks: FileSubjectLock;
  readonly queue: SqliteQueueProjection;
  readonly eventBus: EventBus;
  readonly clock: Clock;
  readonly hooks?: RecoveryHooks;
}

/** Reconciles prepared ingest journals from facts without regenerating semantic output. */
export class RecoveryService {
  readonly #transactions: FileTransactionStore;
  readonly #operations: FileOperationStore;
  readonly #spaces: FileSpaceStore;
  readonly #subjects: FileSubjectStore;
  readonly #states: FileStateStore;
  readonly #materials: FileMaterialStore;
  readonly #events: FileEventStore;
  readonly #staging: FileIngestStaging;
  readonly #requestLocks: FileRequestLock;
  readonly #spaceIdentityLocks: FileSpaceIdentityLock;
  readonly #subjectLocks: FileSubjectLock;
  readonly #queue: SqliteQueueProjection;
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
    this.#spaces = input.spaces;
    this.#subjects = input.subjects;
    this.#states = input.states;
    this.#materials = input.materials;
    this.#events = input.events;
    this.#staging = input.staging;
    this.#requestLocks = input.requestLocks;
    this.#spaceIdentityLocks = input.spaceIdentityLocks;
    this.#subjectLocks = input.subjectLocks;
    this.#queue = input.queue;
    this.#eventBus = input.eventBus;
    this.#clock = input.clock;
    this.#hooks = input.hooks ?? {};
  }

  /** Reconciles every currently visible prepared journal in RequestId order. */
  async reconcileAll(): Promise<void> {
    for (const transaction of await this.#transactions.list()) {
      if (transaction.state === "prepared") await this.reconcile(transaction.requestId);
    }
  }

  /**
   * Reconciles one prepared request under the canonical root-to-subject lock order.
   *
   * @param requestId - Root transaction id to inspect.
   */
  async reconcile(requestId: RequestId): Promise<void> {
    const requestLease = await this.#requestLocks.acquire(requestId);
    let publishedEvents: readonly EngineEvent[];
    try {
      const transaction = await this.#transactions.readOptional(requestId);
      if (transaction === undefined || transaction.state !== "prepared") return;

      const identityLease = transaction.createdSubject
        ? await this.#spaceIdentityLocks.acquire(transaction.spaceId)
        : undefined;
      try {
        const subjectLease = await this.#subjectLocks.acquire(transaction.subjectId);
        try {
          publishedEvents = await this.reconcileLocked(transaction);
        } finally {
          await subjectLease.release();
        }
      } finally {
        await identityLease?.release();
      }
    } finally {
      await requestLease.release();
    }
    for (const event of publishedEvents) await this.#eventBus.publish(event);
  }

  /**
   * Materializes post-commit facts and the queue from one already-visible target state.
   *
   * The caller must hold the journal's request and subject locks. The returned
   * events are published only after those locks have been released.
   *
   * @param transaction - Prepared journal whose target crossed the fact commit point.
   * @param state - Verified target state currently visible at the subject path.
   * @returns The exact persisted invalidations ready for post-lock publication.
   */
  async materializeCommitted(
    transaction: IngestTransactionRecord,
    state: SubjectStateRecord,
  ): Promise<readonly EngineEvent[]> {
    if (transaction.state !== "prepared" || state.checksum !== transaction.targetStateChecksum) {
      throw storageCorrupt("Only a visible prepared ingest target can be materialized.");
    }
    assertTargetState(transaction, state);
    const subject = await this.#subjects.read(transaction.subjectId);
    const space = await this.#spaces.read(transaction.spaceId);
    if (
      subject.spaceId !== space.id ||
      canonicalJson(summarizeSubject(subject, space, state)) !==
        canonicalJson(transaction.operation.result.subject)
    ) {
      throw storageCorrupt("Recovered subject summary does not match the stored ingest result.");
    }
    await this.#operations.write(transaction.operation);
    await this.#hooks.afterOperation?.();
    for (const record of transaction.events) {
      await this.#events.write(transaction.subjectId, record);
      await this.#hooks.afterEvent?.(record.eventId);
    }
    await this.#queue.apply({
      subjectId: transaction.subjectId,
      ...(state.pending === undefined ? {} : { pending: state.pending }),
    });
    await this.#hooks.afterQueue?.();
    await this.#transactions.write(
      terminalTransaction(transaction, "committed", this.#clock.now()),
    );
    return transaction.events.map((record) => record.event);
  }

  private async reconcileLocked(
    transaction: IngestTransactionRecord,
  ): Promise<readonly EngineEvent[]> {
    const subject = await optionalSubject(this.#subjects, transaction);
    const state =
      subject === undefined ? undefined : await optionalState(this.#states, transaction);
    if (subject !== undefined && subject.spaceId !== transaction.spaceId) {
      throw storageCorrupt("Recovered subject space does not match its ingest journal.");
    }
    const targetStateVisible = state?.checksum === transaction.targetStateChecksum;
    const targetSubjectVisible = transaction.createdSubject
      ? subject?.checksum === transaction.targetSubjectChecksum
      : subject !== undefined;

    if (targetStateVisible && targetSubjectVisible && state !== undefined) {
      return this.materializeCommitted(transaction, state);
    }

    const previousVisible = transaction.createdSubject
      ? subject === undefined && state === undefined
      : subject !== undefined && state?.checksum === transaction.previousStateChecksum;
    if (!previousVisible) {
      throw storageCorrupt("Prepared ingest is neither at its target nor its previous fact state.");
    }

    if (transaction.createdSubject) {
      await this.#subjects.assertDirectoryAbsent(transaction.subjectId);
      await this.#staging.cleanup(transaction.requestId, transaction.subjectId);
    } else {
      if (state === undefined) {
        throw storageCorrupt("An existing-subject abort is missing its previous state.");
      }
      const previousMaterialIds = new Set(state.materialManifest.map((entry) => entry.materialId));
      for (const entry of transaction.newMaterials) {
        if (previousMaterialIds.has(entry.materialId)) {
          throw storageCorrupt("An ingest journal cannot clean a previously committed material.");
        }
        await this.#materials.removeJournalMaterial(transaction.subjectId, entry);
      }
    }
    await this.#transactions.write(terminalTransaction(transaction, "aborted", this.#clock.now()));
    return [];
  }
}
