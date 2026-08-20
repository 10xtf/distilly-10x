import { DistillyError } from "@distilly/protocol";
import type { FactChecksum, PendingJobMarker, SubjectId } from "@distilly/protocol";

import { CryptoIdGenerator } from "../defaults/crypto-id-generator.js";
import { InProcessEventBus } from "../defaults/in-process-event-bus.js";
import type { Clock } from "../defaults/system-clock.js";
import { SystemClock } from "../defaults/system-clock.js";
import type { DistillLeaseServiceHooks } from "../distill/lease-service.js";
import { DistillLeaseService } from "../distill/lease-service.js";
import type { CommitServiceHooks } from "../distill/commit-service.js";
import { CommitService } from "../distill/commit-service.js";
import { PromptCatalog } from "../distill/prompt-catalog.js";
import { FileEventStore } from "../facts/event-store.js";
import { FileCurrentProfileProjection } from "../facts/current-profile-projection.js";
import { FileMaterialStore } from "../facts/material-store.js";
import { FileOperationStore } from "../facts/operation-store.js";
import { FileSpaceStore } from "../facts/space-store.js";
import { FileStateStore } from "../facts/state-store.js";
import { FileSubjectStore } from "../facts/subject-store.js";
import { FileTransactionStore } from "../facts/transaction-store.js";
import { FileVersionManifestStore } from "../facts/version-manifest-store.js";
import { FileVersionStore } from "../facts/version-store.js";
import { Layout } from "../layout.js";
import type { EventBus } from "../ports/event-bus.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type { SqliteQueueRepositoryHooks } from "../queue/sqlite-projection.js";
import { SqliteQueueRepository } from "../queue/sqlite-projection.js";
import { SubjectService } from "../subject/service.js";
import { FileIngestStaging } from "../transaction/ingest-staging.js";
import { RecoveryService } from "../transaction/recovery.js";
import type { RecoveryHooks } from "../transaction/recovery.js";
import { FileRequestLock } from "../transaction/request-lock.js";
import { FileSpaceCatalogLock } from "../transaction/space-catalog-lock.js";
import { FileSpaceIdentityLock } from "../transaction/space-identity-lock.js";
import { FileSubjectLock } from "../transaction/subject-lock.js";
import type { VersionStagingHooks } from "../transaction/version-staging.js";
import { FileVersionStaging } from "../transaction/version-staging.js";
import { IngestService } from "./service.js";
import type { IngestServiceHooks } from "./service.js";

/** Trusted seams used only by the package-internal Engine composition. */
export interface InternalEngineCompositionOptions {
  readonly root: string;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly eventBus?: EventBus;
  readonly ingestHooks?: IngestServiceHooks;
  readonly recoveryHooks?: RecoveryHooks;
  readonly queueHooks?: SqliteQueueRepositoryHooks;
  readonly leaseHooks?: DistillLeaseServiceHooks;
  readonly commitHooks?: CommitServiceHooks;
  readonly versionStagingHooks?: VersionStagingHooks;
  readonly promptCatalog?: PromptCatalog;
}

/** Runnable internal V3 slices without claiming the full EngineRuntime API. */
export interface InternalEngineComposition {
  readonly ingest: IngestService;
  readonly leases: DistillLeaseService;
  readonly commits: CommitService;
  readonly recovery: RecoveryService;
  readonly events: EventBus;
}

const rebuildQueueSeeds = async function* (
  subjects: FileSubjectStore,
  states: FileStateStore,
): AsyncGenerator<{
  readonly subjectId: SubjectId;
  readonly stateChecksum: FactChecksum;
  readonly pending?: PendingJobMarker;
}> {
  for (const subject of await subjects.listAll()) {
    const state = await states.read(subject.id);
    yield {
      subjectId: subject.id,
      stateChecksum: state.checksum,
      ...(state.pending === undefined ? {} : { pending: state.pending }),
    };
  }
};

/**
 * Opens the implemented internal Engine slices and reconciles them before use.
 *
 * This module is deliberately absent from the package root. It proves the vertical
 * slice without exposing a partial CoreEngineClient or createEngine contract.
 *
 * @param options - Local root and optional deterministic test seams.
 * @returns The initialized internal ingest and recovery services.
 */
export const createInternalEngineComposition = async (
  options: InternalEngineCompositionOptions,
): Promise<InternalEngineComposition> => {
  const layout = new Layout(options.root);
  const clock = options.clock ?? new SystemClock();
  const ids = options.ids ?? new CryptoIdGenerator();
  const eventBus = options.eventBus ?? new InProcessEventBus();
  const spaces = new FileSpaceStore(layout);
  const subjects = new FileSubjectStore(layout, spaces);
  const materials = new FileMaterialStore(layout, subjects);
  const states = new FileStateStore(layout, subjects, materials);
  const versions = new FileVersionManifestStore(layout, materials);
  const completeVersions = new FileVersionStore(layout, materials);
  const versionStaging = new FileVersionStaging(
    layout,
    completeVersions,
    options.versionStagingHooks,
  );
  const currentProfiles = new FileCurrentProfileProjection(layout, completeVersions);
  const operations = new FileOperationStore(layout, subjects);
  const transactions = new FileTransactionStore(layout);
  const events = new FileEventStore(layout, subjects);
  const staging = new FileIngestStaging(layout, spaces);
  const requestLocks = new FileRequestLock(layout, clock);
  const spaceCatalogLocks = new FileSpaceCatalogLock(layout, clock);
  const spaceIdentityLocks = new FileSpaceIdentityLock(layout, clock);
  const subjectLocks = new FileSubjectLock(layout, clock);
  const queue = new SqliteQueueRepository(
    {
      root: layout.root,
      indexDirectory: layout.indexDirectory(),
      databaseFile: layout.queueDatabaseFile(),
      dirtyFile: layout.queueDirtyFile(),
    },
    options.queueHooks,
  );
  const recovery = new RecoveryService({
    transactions,
    operations,
    spaces,
    subjects,
    states,
    materials,
    events,
    versions: completeVersions,
    versionStaging,
    currentProfiles,
    staging,
    requestLocks,
    spaceIdentityLocks,
    subjectLocks,
    queue,
    eventBus,
    clock,
    ...(options.recoveryHooks === undefined ? {} : { hooks: options.recoveryHooks }),
  });
  const subjectService = new SubjectService(
    spaces,
    subjects,
    states,
    spaceCatalogLocks,
    spaceIdentityLocks,
    ids,
  );
  const ingest = new IngestService({
    spaces,
    subjects,
    states,
    materials,
    versions,
    operations,
    transactions,
    staging,
    requestLocks,
    spaceIdentityLocks,
    subjectLocks,
    subjectService,
    recovery,
    ids,
    clock,
    eventBus,
    ...(options.ingestHooks === undefined ? {} : { hooks: options.ingestHooks }),
  });
  const promptCatalog = options.promptCatalog ?? new PromptCatalog();
  const leases = new DistillLeaseService({
    spaces,
    subjects,
    states,
    materials,
    versions: completeVersions,
    operations,
    transactions,
    requestLocks,
    subjectLocks,
    queue,
    recovery,
    promptCatalog,
    ids,
    clock,
    eventBus,
    ...(options.leaseHooks === undefined ? {} : { hooks: options.leaseHooks }),
  });
  const commits = new CommitService({
    subjects,
    states,
    materials,
    versions: completeVersions,
    versionStaging,
    operations,
    transactions,
    requestLocks,
    subjectLocks,
    queue,
    recovery,
    promptCatalog,
    ids,
    clock,
    eventBus,
    ...(options.commitHooks === undefined ? {} : { hooks: options.commitHooks }),
  });

  try {
    await queue.verifyAvailable();
  } catch (error) {
    if (!(error instanceof DistillyError) || error.code !== "index_unavailable") throw error;
    await queue.rebuild(() => rebuildQueueSeeds(subjects, states), clock.now());
  }
  await recovery.reconcileAll();
  await queue.verifyAvailable();
  return { ingest, leases, commits, recovery, events: eventBus };
};
