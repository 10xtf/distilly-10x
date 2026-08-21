import {
  DistillyError,
  actorContextSchema,
  engineMethodSchemas,
  mutationContextSchema,
  transactionRecordSchema,
} from "@distilly/protocol";
import type {
  ActorContext,
  EngineEvent,
  EventRecord,
  IngestInput,
  IngestItemResult,
  IngestResult,
  IngestTransactionRecord,
  IsoDateTime,
  MaterialId,
  MutationContext,
  OperationFact,
  OperationRecord,
  SpaceRecord,
  SubjectId,
  SubjectRecord,
  SubjectStateRecord,
  VersionMaterialEntry,
} from "@distilly/protocol";

import type { Clock } from "../defaults/system-clock.js";
import { computeFactChecksum, sealFact } from "../facts/checksum.js";
import type { FileMaterialStore, StoredMaterial } from "../facts/material-store.js";
import type { FileOperationStore } from "../facts/operation-store.js";
import type { FileSpaceStore } from "../facts/space-store.js";
import type { FileStateStore } from "../facts/state-store.js";
import type { FileSubjectStore } from "../facts/subject-store.js";
import type { FileTransactionStore } from "../facts/transaction-store.js";
import type { FileVersionManifestStore } from "../facts/version-manifest-store.js";
import {
  factNotFound,
  idempotencyConflict,
  invalidInput,
  lockBusy,
  storageCorrupt,
} from "../internal-errors.js";
import type { EventBus } from "../ports/event-bus.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type { FileIngestStaging } from "../transaction/ingest-staging.js";
import type { FileRequestLock } from "../transaction/request-lock.js";
import type { RecoveryService } from "../transaction/recovery.js";
import type { FileSpaceIdentityLock } from "../transaction/space-identity-lock.js";
import type { FileSubjectLock } from "../transaction/subject-lock.js";
import type { NormalizedIngestSubjectTarget } from "../subject/identity.js";
import { canonicalizeIngestSubjectTarget } from "../subject/identity.js";
import { SubjectService, summarizeSubject } from "../subject/service.js";
import type { PreparedMaterial } from "./normalize.js";
import { normalizeMaterial, prepareMaterial } from "./normalize.js";
import type { IngestBaseline } from "./state-transition.js";
import { deriveIngestState } from "./state-transition.js";

interface PreparedBatch {
  readonly accepted: readonly PreparedMaterial[];
  readonly items: readonly IngestItemResult[];
  readonly targetManifest: readonly VersionMaterialEntry[];
  readonly storedAtByMaterialId: ReadonlyMap<MaterialId, IsoDateTime>;
}

interface LockedOutcome {
  readonly result: IngestResult;
  readonly events: readonly EngineEvent[];
}

/** Fault-injection hooks for the package-internal Step 5 transaction tests. */
export interface IngestServiceHooks {
  /** Runs while canonical subject locks are held, immediately before journal publication. */
  readonly beforePrepared?: (transaction: IngestTransactionRecord) => void | Promise<void>;
  /** Runs after the complete prepared journal is durable. */
  readonly afterPrepared?: (transaction: IngestTransactionRecord) => void | Promise<void>;
  /** Runs after one existing-subject material directory is durable. */
  readonly afterMaterialWrite?: (materialId: MaterialId) => void | Promise<void>;
  /** Runs after the subject target state or complete create directory is visible. */
  readonly afterFactCommit?: (transaction: IngestTransactionRecord) => void | Promise<void>;
}

/** Concrete dependencies for the package-internal Step 5 ingest service. */
export interface IngestServiceDependencies {
  readonly spaces: FileSpaceStore;
  readonly subjects: FileSubjectStore;
  readonly states: FileStateStore;
  readonly materials: FileMaterialStore;
  readonly versions: FileVersionManifestStore;
  readonly operations: FileOperationStore;
  readonly transactions: FileTransactionStore;
  readonly staging: FileIngestStaging;
  readonly requestLocks: FileRequestLock;
  readonly spaceIdentityLocks: FileSpaceIdentityLock;
  readonly subjectLocks: FileSubjectLock;
  readonly subjectService: SubjectService;
  readonly recovery: RecoveryService;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly eventBus: EventBus;
  readonly hooks?: IngestServiceHooks;
}

const optionalMaterial = async (
  materials: FileMaterialStore,
  subjectId: SubjectId,
  materialId: MaterialId,
): Promise<StoredMaterial | undefined> => {
  try {
    return await materials.read(subjectId, materialId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") return undefined;
    throw error;
  }
};

const requiredState = async (
  states: FileStateStore,
  subjectId: SubjectId,
): Promise<SubjectStateRecord> => {
  try {
    return await states.read(subjectId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") {
      throw storageCorrupt("A published subject is missing its authoritative state.", error);
    }
    throw error;
  }
};

const initialState = (subjectId: SubjectId): SubjectStateRecord =>
  sealFact<SubjectStateRecord>({
    schemaVersion: 2,
    subjectId,
    generation: 0,
    materialManifest: [],
  });

const actorEquals = (left: ActorContext, right: ActorContext): boolean =>
  left.kind === right.kind && left.id === right.id && left.host === right.host;

const parseBoundary = <T>(parse: () => T, fieldPath: string): T => {
  try {
    return parse();
  } catch (error) {
    if (error instanceof DistillyError) throw error;
    throw invalidInput("The materials.ingest boundary input is invalid.", fieldPath);
  }
};

const sortedEntries = (materials: readonly PreparedMaterial[]): readonly VersionMaterialEntry[] =>
  materials
    .map(({ record }) => ({
      materialId: record.id,
      contentDigest: record.contentDigest,
      provenanceDigest: record.provenanceDigest,
    }))
    .sort((left, right) =>
      left.materialId < right.materialId ? -1 : left.materialId > right.materialId ? 1 : 0,
    );

const requireMaterialSetHash = (
  state: SubjectStateRecord,
): NonNullable<SubjectStateRecord["materialSetHash"]> => {
  if (state.materialSetHash === undefined) {
    throw storageCorrupt("A non-empty ingest target is missing its material-set hash.");
  }
  return state.materialSetHash;
};

const replayOperation = (
  operation: OperationFact,
  inputChecksum: OperationRecord<"materials.ingest">["inputChecksum"],
): IngestResult => {
  if (operation.method !== "materials.ingest" || operation.inputChecksum !== inputChecksum) {
    throw idempotencyConflict("RequestId was already used by a different mutation input.");
  }
  if (operation.recordKind === "tombstone") {
    throw factNotFound("The subject previously owned by this request was purged.");
  }
  return operation.result;
};

const makeEventRecord = (
  kind: EngineEvent["kind"],
  subjectId: SubjectId,
  at: IsoDateTime,
  actor: ActorContext,
  requestId: MutationContext["requestId"],
  ids: IdGenerator,
): EventRecord =>
  sealFact<EventRecord>({
    schemaVersion: 1,
    eventId: ids.eventId(),
    event: { kind, subjectId, at },
    actor,
    requestId,
  });

const makePreparedTransaction = (input: {
  readonly requestId: MutationContext["requestId"];
  readonly space: SpaceRecord;
  readonly subject: SubjectRecord;
  readonly previous: SubjectStateRecord;
  readonly target: SubjectStateRecord;
  readonly created: boolean;
  readonly accepted: readonly PreparedMaterial[];
  readonly operation: OperationRecord<"materials.ingest">;
  readonly events: readonly EventRecord[];
  readonly preparedAt: IsoDateTime;
}): IngestTransactionRecord => {
  const payload = {
    schemaVersion: 1,
    transactionKind: "ingest",
    requestId: input.requestId,
    spaceId: input.space.id,
    subjectId: input.subject.id,
    targetStateChecksum: input.target.checksum,
    newMaterials: sortedEntries(input.accepted),
    operation: input.operation,
    events: input.events,
    preparedAt: input.preparedAt,
    ...(input.created
      ? {
          createdSubject: true,
          targetSubjectChecksum: input.subject.checksum,
        }
      : {
          createdSubject: false,
          previousStateChecksum: input.previous.checksum,
        }),
    state: "prepared",
  } as const;
  return transactionRecordSchema.parse({
    ...payload,
    checksum: computeFactChecksum(payload),
  }) as IngestTransactionRecord;
};

/** Atomic create-or-existing text ingest below the public CoreEngineClient boundary. */
export class IngestService {
  readonly #dependencies: IngestServiceDependencies;

  /**
   * Creates the package-internal ingest coordinator.
   *
   * @param dependencies - Concrete stores, locks, recovery, and trusted seams.
   */
  constructor(dependencies: IngestServiceDependencies) {
    this.#dependencies = dependencies;
  }

  /**
   * Performs one globally idempotent atomic text ingest.
   *
   * @param rawInput - Untrusted method parameters parsed at this boundary.
   * @param rawActor - Trusted session actor attached by the composition.
   * @param rawMutation - Caller-generated RequestId retained across retries.
   * @returns The exact stored operation result.
   */
  async ingest(
    rawInput: IngestInput,
    rawActor: ActorContext,
    rawMutation: MutationContext,
  ): Promise<IngestResult> {
    const input = parseBoundary(
      () => engineMethodSchemas["materials.ingest"].params.parse(rawInput),
      "params",
    );
    const actor = parseBoundary(() => actorContextSchema.parse(rawActor) as ActorContext, "actor");
    const mutation = parseBoundary(
      () => mutationContextSchema.parse(rawMutation) as MutationContext,
      "requestId",
    );
    const canonicalTarget = canonicalizeIngestSubjectTarget(input.subject).target;
    const normalizedMaterials = input.materials.map(normalizeMaterial);
    const inputChecksum = computeFactChecksum({
      method: "materials.ingest",
      params: {
        subject: canonicalTarget,
        materials: normalizedMaterials,
        enqueue: input.enqueue,
      },
      actor,
    });
    let candidateSubjectId =
      canonicalTarget.kind === "existing"
        ? canonicalTarget.subjectId
        : this.#dependencies.ids.subjectId();

    for (;;) {
      await this.#dependencies.recovery.reconcilePending();
      const requestLease = await this.#dependencies.requestLocks.acquire(mutation.requestId);
      let outcome: LockedOutcome;
      try {
        const operation = await this.#dependencies.operations.readOptional(mutation.requestId);
        if (operation !== undefined) {
          return replayOperation(operation, inputChecksum);
        }
        const journal = await this.#dependencies.transactions.readOptional(mutation.requestId);
        if (journal !== undefined) {
          if (
            journal.operation.method !== "materials.ingest" ||
            journal.operation.inputChecksum !== inputChecksum ||
            !actorEquals(journal.operation.actor, actor)
          ) {
            throw idempotencyConflict("RequestId was already used by a different mutation input.");
          }
          if (journal.state === "prepared") {
            continue;
          }
          if (journal.state === "committed") {
            throw storageCorrupt("A committed ingest journal is missing its operation fact.");
          }
          candidateSubjectId = journal.subjectId;
        }

        const now = this.#dependencies.clock.now();
        const preparedMaterials = normalizedMaterials.map((material) =>
          prepareMaterial(material, candidateSubjectId, mutation.requestId, now),
        );
        outcome =
          canonicalTarget.kind === "existing"
            ? await this.ingestExisting(
                input,
                actor,
                mutation,
                inputChecksum,
                canonicalTarget,
                preparedMaterials,
                now,
              )
            : await this.ingestCreate(
                input,
                actor,
                mutation,
                inputChecksum,
                canonicalTarget,
                candidateSubjectId,
                preparedMaterials,
                now,
              );
      } finally {
        await requestLease.release();
      }

      for (const event of outcome.events) await this.#dependencies.eventBus.publish(event);
      return outcome.result;
    }
  }

  private async ingestExisting(
    input: IngestInput,
    actor: ActorContext,
    mutation: MutationContext,
    inputChecksum: OperationRecord<"materials.ingest">["inputChecksum"],
    target: Extract<NormalizedIngestSubjectTarget, { readonly kind: "existing" }>,
    preparedMaterials: readonly PreparedMaterial[],
    now: IsoDateTime,
  ): Promise<LockedOutcome> {
    const lease = await this.#dependencies.subjectLocks.acquire(target.subjectId);
    try {
      const subject = await this.#dependencies.subjects.read(target.subjectId);
      const space = await this.#dependencies.spaces.read(subject.spaceId);
      const previous = await requiredState(this.#dependencies.states, subject.id);
      await this.assertNoRelevantPrepared(mutation.requestId, space.id, subject.id, false);
      return await this.commitLocked({
        input,
        actor,
        mutation,
        inputChecksum,
        subject,
        space,
        previous,
        created: false,
        preparedMaterials,
        now,
      });
    } finally {
      await lease.release();
    }
  }

  private async ingestCreate(
    input: IngestInput,
    actor: ActorContext,
    mutation: MutationContext,
    inputChecksum: OperationRecord<"materials.ingest">["inputChecksum"],
    target: Extract<NormalizedIngestSubjectTarget, { readonly kind: "create" }>,
    subjectId: SubjectId,
    preparedMaterials: readonly PreparedMaterial[],
    now: IsoDateTime,
  ): Promise<LockedOutcome> {
    const space = await this.#dependencies.subjectService.resolveCreateSpace(target.input);
    const identityLease = await this.#dependencies.spaceIdentityLocks.acquire(space.id);
    try {
      await this.#dependencies.subjectService.assertCreateAvailable(target.input, space);
      const subjectLease = await this.#dependencies.subjectLocks.acquire(subjectId);
      try {
        await this.assertNoRelevantPrepared(mutation.requestId, space.id, subjectId, true);
        await this.#dependencies.subjects.assertDirectoryAbsent(subjectId);
        const subject = this.#dependencies.subjectService.createRecord(
          target.input,
          space,
          subjectId,
        );
        return await this.commitLocked({
          input,
          actor,
          mutation,
          inputChecksum,
          subject,
          space,
          previous: initialState(subjectId),
          created: true,
          preparedMaterials,
          now,
        });
      } finally {
        await subjectLease.release();
      }
    } finally {
      await identityLease.release();
    }
  }

  private async commitLocked(input: {
    readonly input: IngestInput;
    readonly actor: ActorContext;
    readonly mutation: MutationContext;
    readonly inputChecksum: OperationRecord<"materials.ingest">["inputChecksum"];
    readonly subject: SubjectRecord;
    readonly space: SpaceRecord;
    readonly previous: SubjectStateRecord;
    readonly created: boolean;
    readonly preparedMaterials: readonly PreparedMaterial[];
    readonly now: IsoDateTime;
  }): Promise<LockedOutcome> {
    const batch = await this.classifyBatch(
      input.subject.id,
      input.previous,
      input.preparedMaterials,
      input.created,
    );
    const baseline = await this.readBaseline(input.subject.id, input.previous);
    const derived = deriveIngestState({
      subjectId: input.subject.id,
      previous: input.previous,
      targetManifest: batch.targetManifest,
      ...(baseline === undefined ? {} : { baseline }),
      storedAtByMaterialId: batch.storedAtByMaterialId,
      enqueue: input.input.enqueue,
      now: input.now,
      nextJobId: () => this.#dependencies.ids.jobId(),
    });
    const subjectSummary = summarizeSubject(input.subject, input.space, derived.state);
    const materialSetHash = requireMaterialSetHash(derived.state);
    const result: IngestResult =
      batch.accepted.length === 0
        ? {
            kind: "unchanged",
            subject: subjectSummary,
            items: batch.items,
            materialSetHash,
            generation: derived.state.generation,
            ...(derived.job === undefined ? {} : { job: derived.job }),
          }
        : {
            kind: "ingested",
            subject: subjectSummary,
            created: input.created,
            items: batch.items,
            materialSetHash,
            generation: derived.state.generation,
            ...(derived.job === undefined ? {} : { job: derived.job }),
          };
    const operation = sealFact<OperationRecord<"materials.ingest">>({
      schemaVersion: 1,
      recordKind: "completed",
      requestId: input.mutation.requestId,
      method: "materials.ingest",
      scope: { kind: "subject", subjectId: input.subject.id },
      actor: input.actor,
      inputChecksum: input.inputChecksum,
      result,
      completedAt: input.now,
    });
    const events: EventRecord[] = [];
    if (input.created) {
      events.push(
        makeEventRecord(
          "subject.created",
          input.subject.id,
          input.now,
          input.actor,
          input.mutation.requestId,
          this.#dependencies.ids,
        ),
      );
    }
    if (batch.accepted.length !== 0) {
      events.push(
        makeEventRecord(
          "material.ingested",
          input.subject.id,
          input.now,
          input.actor,
          input.mutation.requestId,
          this.#dependencies.ids,
        ),
      );
    }
    if (derived.pendingChanged) {
      events.push(
        makeEventRecord(
          "job.changed",
          input.subject.id,
          input.now,
          input.actor,
          input.mutation.requestId,
          this.#dependencies.ids,
        ),
      );
    }
    const transaction = makePreparedTransaction({
      requestId: input.mutation.requestId,
      space: input.space,
      subject: input.subject,
      previous: input.previous,
      target: derived.state,
      created: input.created,
      accepted: batch.accepted,
      operation,
      events,
      preparedAt: input.now,
    });
    await this.#dependencies.hooks?.beforePrepared?.(transaction);
    await this.#dependencies.transactions.write(transaction);
    await this.#dependencies.hooks?.afterPrepared?.(transaction);

    if (input.created) {
      await this.#dependencies.staging.cleanup(input.mutation.requestId, input.subject.id);
      await this.#dependencies.staging.prepare(input.mutation.requestId, {
        subject: input.subject,
        materials: batch.accepted,
        state: derived.state,
      });
      await this.#dependencies.staging.publish(input.mutation.requestId, input.subject.id);
    } else {
      for (const material of batch.accepted) {
        await this.#dependencies.materials.write(material.record, material.content);
        await this.#dependencies.hooks?.afterMaterialWrite?.(material.record.id);
      }
      if (derived.state.checksum !== input.previous.checksum) {
        await this.#dependencies.states.write(derived.state);
      }
    }
    await this.#dependencies.hooks?.afterFactCommit?.(transaction);

    const publishedEvents = await this.#dependencies.recovery.materializeCommitted(
      transaction,
      derived.state,
    );
    return { result, events: publishedEvents };
  }

  private async classifyBatch(
    subjectId: SubjectId,
    previous: SubjectStateRecord,
    prepared: readonly PreparedMaterial[],
    creating: boolean,
  ): Promise<PreparedBatch> {
    const previousById = new Map(
      previous.materialManifest.map((entry) => [entry.materialId, entry]),
    );
    const storedAtByMaterialId = new Map<MaterialId, IsoDateTime>();
    for (const entry of previous.materialManifest) {
      const existing = await this.#dependencies.materials.read(subjectId, entry.materialId);
      storedAtByMaterialId.set(entry.materialId, existing.record.storedAt);
    }

    const seen = new Map<MaterialId, PreparedMaterial>();
    const accepted: PreparedMaterial[] = [];
    const items: IngestItemResult[] = [];
    for (const material of prepared) {
      let disposition: IngestItemResult["kind"];
      const duplicateInBatch = seen.get(material.record.id);
      if (duplicateInBatch !== undefined) {
        if (
          duplicateInBatch.record.contentDigest !== material.record.contentDigest ||
          duplicateInBatch.record.provenanceDigest !== material.record.provenanceDigest ||
          duplicateInBatch.content !== material.content
        ) {
          throw storageCorrupt("One material id resolved to conflicting batch contents.");
        }
        disposition = "duplicate";
      } else {
        seen.set(material.record.id, material);
        const previousEntry = previousById.get(material.record.id);
        if (previousEntry !== undefined) {
          if (
            previousEntry.contentDigest !== material.record.contentDigest ||
            previousEntry.provenanceDigest !== material.record.provenanceDigest
          ) {
            throw storageCorrupt("Existing material id disagrees with its state manifest.");
          }
          disposition = "duplicate";
        } else {
          if (!creating) {
            const orphan = await optionalMaterial(
              this.#dependencies.materials,
              subjectId,
              material.record.id,
            );
            if (orphan !== undefined) {
              throw storageCorrupt(
                "A material directory exists outside the authoritative manifest.",
              );
            }
          }
          disposition = "accepted";
          accepted.push(material);
          storedAtByMaterialId.set(material.record.id, material.record.storedAt);
        }
      }
      items.push({
        clientRef: material.clientRef,
        kind: disposition,
        materialId: material.record.id,
        contentDigest: material.record.contentDigest,
      });
    }
    const targetManifest = [...previous.materialManifest, ...sortedEntries(accepted)].sort(
      (left, right) =>
        left.materialId < right.materialId ? -1 : left.materialId > right.materialId ? 1 : 0,
    );
    return { accepted, items, targetManifest, storedAtByMaterialId };
  }

  private async readBaseline(
    subjectId: SubjectId,
    state: SubjectStateRecord,
  ): Promise<IngestBaseline | undefined> {
    if (state.currentVersionId === undefined) return undefined;
    let stored;
    try {
      stored = await this.#dependencies.versions.read(subjectId, state.currentVersionId);
    } catch (error) {
      if (error instanceof DistillyError && error.code === "not_found") {
        throw storageCorrupt("Subject state points to a missing current version.", error);
      }
      throw error;
    }
    return { versionId: stored.version.id, manifest: stored.manifest.items };
  }

  private async assertNoRelevantPrepared(
    requestId: MutationContext["requestId"],
    spaceId: SpaceRecord["id"],
    subjectId: SubjectId,
    creating: boolean,
  ): Promise<void> {
    for (const transaction of await this.#dependencies.transactions.list()) {
      if (transaction.requestId === requestId || transaction.state !== "prepared") continue;
      if (
        transaction.subjectId === subjectId ||
        (creating &&
          transaction.transactionKind === "ingest" &&
          transaction.createdSubject &&
          transaction.spaceId === spaceId)
      ) {
        throw lockBusy(
          "Another prepared transaction must be reconciled before this subject can change.",
        );
      }
    }
  }
}
