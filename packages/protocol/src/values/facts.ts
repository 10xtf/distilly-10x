import type { EngineEvent } from "../events.js";
import type {
  ContentDigest,
  EventId,
  FactChecksum,
  IsoDateTime,
  JobId,
  MaterialId,
  MaterialSetHash,
  ProvenanceDigest,
  RequestId,
  SpaceId,
  SubjectId,
  VersionId,
} from "../ids.js";
import type { EngineMethodMap, MutationMethodName } from "../methods.js";
import type { ActorContext } from "../values.js";
import type { IdentityHint, SubjectLifecycle } from "./subjects.js";

/** Integrity envelope shared by every persisted JSON fact. */
export interface FactEnvelope<V extends number = number> {
  readonly schemaVersion: V;
  readonly checksum: FactChecksum;
}

/** Persisted namespace for one class of subjects. */
export interface SpaceRecord extends FactEnvelope<1> {
  readonly id: SpaceId;
  readonly displayName: string;
  readonly kind: "people" | "fictional" | "custom";
}

/** Persisted subject identity independent of derived profile state. */
export interface SubjectRecord extends FactEnvelope<1> {
  readonly id: SubjectId;
  readonly spaceId: SpaceId;
  readonly displayName: string;
  readonly aliases: readonly string[];
  readonly identityHints: readonly IdentityHint[];
  readonly domainPack?: string;
  readonly lifecycle: SubjectLifecycle;
}

/** Digest-only membership entry shared by current and historical manifests. */
export interface VersionMaterialEntry {
  readonly materialId: MaterialId;
  readonly contentDigest: ContentDigest;
  readonly provenanceDigest: ProvenanceDigest;
}

/** Stable pending-work fields that can rebuild the disposable queue. */
export interface PendingJobMarker {
  readonly jobId: JobId;
  readonly generation: number;
  readonly baseVersionId?: VersionId;
  readonly materialSetHash: MaterialSetHash;
  readonly addedMaterialCount: number;
  readonly totalMaterialCount: number;
  readonly queuedAt: IsoDateTime;
}

/** Authoritative current state for one subject. */
export interface SubjectStateRecord extends FactEnvelope<1> {
  readonly subjectId: SubjectId;
  readonly generation: number;
  readonly materialSetHash?: MaterialSetHash;
  readonly materialManifest: readonly VersionMaterialEntry[];
  readonly currentVersionId?: VersionId;
  readonly suspendedVersionId?: VersionId;
  readonly pending?: PendingJobMarker;
}

/** Durable wrapper around one post-commit invalidation event. */
export interface EventRecord extends FactEnvelope<1> {
  readonly eventId: EventId;
  readonly event: EngineEvent;
  readonly actor: ActorContext;
  readonly requestId?: RequestId;
}

/** Result stored for one successful mutation method. */
export type StoredOperationResult<M extends MutationMethodName> = EngineMethodMap[M]["result"];

/** Durable idempotency result correlated by its mutation method discriminant. */
export type OperationRecord<M extends MutationMethodName = MutationMethodName> = {
  [K in M]: FactEnvelope<1> & {
    readonly requestId: RequestId;
    readonly method: K;
    readonly actor: ActorContext;
    readonly inputChecksum: FactChecksum;
    readonly result: StoredOperationResult<K>;
    readonly completedAt: IsoDateTime;
  };
}[M];

interface IngestTransactionBase extends FactEnvelope<1> {
  readonly transactionKind: "ingest";
  readonly requestId: RequestId;
  readonly subjectId: SubjectId;
  readonly createdSubject: boolean;
  readonly previousStateChecksum?: FactChecksum;
  readonly targetStateChecksum: FactChecksum;
  readonly newMaterials: readonly VersionMaterialEntry[];
  readonly operation: OperationRecord<"materials.ingest">;
  readonly events: readonly EventRecord[];
  readonly preparedAt: IsoDateTime;
}

/** Crash-recoverable journal for one atomic material ingest. */
export type IngestTransactionRecord =
  | (IngestTransactionBase & { readonly state: "prepared" })
  | (IngestTransactionBase & {
      readonly state: "committed" | "aborted";
      readonly finishedAt: IsoDateTime;
    });
