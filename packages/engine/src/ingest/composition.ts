import { CryptoIdGenerator } from "../defaults/crypto-id-generator.js";
import { InProcessEventBus } from "../defaults/in-process-event-bus.js";
import type { Clock } from "../defaults/system-clock.js";
import { SystemClock } from "../defaults/system-clock.js";
import type { EventBus } from "../ports/event-bus.js";
import type { IdGenerator } from "../ports/id-generator.js";
import { ContentAddressedBlobStore } from "../storage/content-addressed-blob-store.js";
import { SqliteEngineStore } from "../storage/sqlite-engine-store.js";
import type { SubjectCreateServiceHooks } from "../subject/service.js";
import { SubjectCreateService } from "../subject/service.js";
import { IngestService } from "./service.js";
import type { IngestServiceHooks } from "./service.js";

/** Trusted seams used only by the package-private SQLite create/ingest composition. */
export interface InternalEngineCompositionOptions {
  readonly root: string;
  readonly clock?: Clock;
  readonly ids?: IdGenerator;
  readonly eventBus?: EventBus;
  readonly subjectHooks?: SubjectCreateServiceHooks;
  readonly ingestHooks?: IngestServiceHooks;
}

/** Runnable SQLite create/ingest slice without claiming the full EngineRuntime API. */
export interface InternalEngineComposition {
  readonly subjects: SubjectCreateService;
  readonly ingest: IngestService;
  readonly blobs: ContentAddressedBlobStore;
  readonly events: EventBus;
  close(): void;
}

/**
 * Opens the first single-writer SQLite business-method slice.
 *
 * @param options - Root path and trusted composition seams.
 * @returns The runnable create/ingest slice and its owned close operation.
 */
export const createInternalEngineComposition = async (
  options: InternalEngineCompositionOptions,
): Promise<InternalEngineComposition> => {
  const store = await SqliteEngineStore.open(options.root);
  try {
    const blobs = await ContentAddressedBlobStore.open(options.root);
    const eventBus = options.eventBus ?? new InProcessEventBus();
    const ids = options.ids ?? new CryptoIdGenerator();
    const clock = options.clock ?? new SystemClock();
    const subjects = new SubjectCreateService({
      store,
      ids,
      clock,
      eventBus,
      ...(options.subjectHooks === undefined ? {} : { hooks: options.subjectHooks }),
    });
    const ingest = new IngestService({
      store,
      blobs,
      ids,
      clock,
      eventBus,
      ...(options.ingestHooks === undefined ? {} : { hooks: options.ingestHooks }),
    });
    return {
      subjects,
      ingest,
      blobs,
      events: eventBus,
      close: () => store.close(),
    };
  } catch (error) {
    store.close();
    throw error;
  }
};
