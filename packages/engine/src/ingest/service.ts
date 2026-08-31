import type { DatabaseSync } from "node:sqlite";

import {
  DistillyError,
  actorContextSchema,
  contentDigestSchema,
  engineMethodSchemas,
  ingestResultSchema,
  isoDateTimeSchema,
  jobIdSchema,
  materialIdSchema,
  materialRecordSchema,
  materialSetHashSchema,
  mutationContextSchema,
  provenanceDigestSchema,
  subjectStateRecordSchema,
  versionIdSchema,
} from "@distilly/protocol";
import type {
  ActorContext,
  ContentDigest,
  EngineEvent,
  FactChecksum,
  IngestInput,
  IngestItemResult,
  IngestResult,
  IsoDateTime,
  MaterialId,
  MaterialRecord,
  MutationContext,
  PendingJobMarker,
  SubjectId,
  SubjectStateRecord,
  SubjectSummary,
  VersionMaterialEntry,
} from "@distilly/protocol";

import type { Clock } from "../defaults/system-clock.js";
import { canonicalJson } from "../facts/canonical-json.js";
import { sealFact, verifyFactChecksum } from "../facts/checksum.js";
import { deriveMaterialId, digestMaterialProvenance, hashMaterialSet } from "../facts/digests.js";
import { factNotFound, invalidInput, storageCorrupt } from "../internal-errors.js";
import type { EventBus } from "../ports/event-bus.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type {
  BlobPutResult,
  ContentAddressedBlobStore,
} from "../storage/content-addressed-blob-store.js";
import {
  computeMutationInputChecksum,
  insertCompletedOperationInTransaction,
  insertEventInTransaction,
  replayCompletedMutation,
} from "../storage/mutation-ledger.js";
import type { SqliteEngineStore } from "../storage/sqlite-engine-store.js";
import {
  createSubjectIdentityInTransaction,
  loadSubjectSummaryInTransaction,
} from "../subject/transactional-identity.js";
import type { NormalizedIngestSubjectTarget } from "../subject/identity.js";
import { canonicalizeIngestSubjectTarget } from "../subject/identity.js";
import type { PreparedMaterial } from "./normalize.js";
import { normalizeMaterial, prepareMaterial } from "./normalize.js";
import { deriveIngestState } from "./state-transition.js";

interface StoredMaterialRow {
  readonly materialId: MaterialId;
  readonly kind: MaterialRecord["kind"];
  readonly contentDigest: ContentDigest;
  readonly provenanceDigest: VersionMaterialEntry["provenanceDigest"];
  readonly sourceIdentity: string;
  readonly identityJson: string;
  readonly record: MaterialRecord;
  readonly blobDigest: ContentDigest;
  readonly blobByteLength: number;
  readonly storedAt: IsoDateTime;
}

interface PreparedBatch {
  readonly accepted: readonly PreparedMaterial[];
  readonly items: readonly IngestItemResult[];
  readonly targetManifest: readonly VersionMaterialEntry[];
  readonly storedAtByMaterialId: ReadonlyMap<MaterialId, IsoDateTime>;
}

interface TransactionOutcome {
  readonly result: IngestResult;
  readonly events: readonly EngineEvent[];
  readonly committed: boolean;
}

/** Fault hooks used by real process-crash tests at durable boundaries. */
export interface IngestServiceHooks {
  /** Runs after each unique immutable content blob is published. */
  readonly afterBlobPut?: (contentDigest: ContentDigest) => void | Promise<void>;
  /** Runs synchronously after all SQL writes and immediately before COMMIT. */
  readonly beforeTransactionCommit?: (requestId: MutationContext["requestId"]) => void;
  /** Runs after COMMIT and before post-commit invalidation publication. */
  readonly afterTransactionCommit?: (
    requestId: MutationContext["requestId"],
  ) => void | Promise<void>;
}

/** Concrete dependencies for the package-private SQLite ingest slice. */
export interface IngestServiceDependencies {
  readonly store: SqliteEngineStore;
  readonly blobs: ContentAddressedBlobStore;
  readonly ids: IdGenerator;
  readonly clock: Clock;
  readonly eventBus: EventBus;
  readonly hooks?: IngestServiceHooks;
}

const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

const text = (row: Readonly<Record<string, unknown>>, key: string): string => {
  const value = row[key];
  if (typeof value !== "string") throw storageCorrupt(`SQLite ${key} is invalid.`);
  return value;
};

const nullableText = (row: Readonly<Record<string, unknown>>, key: string): string | undefined => {
  const value = row[key];
  if (value === null) return undefined;
  if (typeof value !== "string") throw storageCorrupt(`SQLite ${key} is invalid.`);
  return value;
};

const integer = (row: Readonly<Record<string, unknown>>, key: string): number => {
  const value = row[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw storageCorrupt(`SQLite ${key} is invalid.`);
  }
  return value;
};

const sqliteBoolean = (row: Readonly<Record<string, unknown>>, key: string): boolean => {
  const value = integer(row, key);
  if (value !== 0 && value !== 1) throw storageCorrupt(`SQLite ${key} is not boolean.`);
  return value === 1;
};

const utf8Blob = (row: Readonly<Record<string, unknown>>, key: string): string => {
  const value = row[key];
  if (!(value instanceof Uint8Array)) throw storageCorrupt(`SQLite ${key} is invalid.`);
  try {
    return UTF8_DECODER.decode(value);
  } catch (error) {
    throw storageCorrupt(`SQLite ${key} is not canonical UTF-8.`, error);
  }
};

const parseBoundary = <T>(parse: () => T, fieldPath: string): T => {
  try {
    return parse();
  } catch (error) {
    if (error instanceof DistillyError) throw error;
    throw invalidInput("The materials.ingest boundary input is invalid.", fieldPath);
  }
};

const parseStored = <T>(parse: () => T, label: string): T => {
  try {
    return parse();
  } catch (error) {
    if (error instanceof DistillyError && error.code === "storage_corrupt") throw error;
    throw storageCorrupt(`SQLite ${label} is invalid.`, error);
  }
};

const parseJson = (value: string, label: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw storageCorrupt(`SQLite ${label} is not valid JSON.`, error);
  }
};

const queryOne = (
  database: DatabaseSync,
  sql: string,
  values: readonly (string | number | bigint | Uint8Array | null)[],
  label: string,
): Readonly<Record<string, unknown>> | undefined => {
  try {
    return database.prepare(sql).get(...values);
  } catch (error) {
    throw storageCorrupt(`SQLite could not read ${label}.`, error);
  }
};

const queryAll = (
  database: DatabaseSync,
  sql: string,
  values: readonly (string | number | bigint | Uint8Array | null)[],
  label: string,
): readonly Readonly<Record<string, unknown>>[] => {
  try {
    return database.prepare(sql).all(...values);
  } catch (error) {
    throw storageCorrupt(`SQLite could not read ${label}.`, error);
  }
};

/**
 * Selects the material fields that determine immutable identity.
 *
 * @param record - The canonical stored material record.
 * @returns Identity-bearing semantics without first-seen display metadata.
 */
const materialIdentitySemantics = (record: MaterialRecord): unknown => {
  const source = Object.fromEntries(
    Object.entries(record.source).filter(([key]) => key !== "title" && key !== "capturedAt"),
  );
  return {
    id: record.id,
    subjectId: record.subjectId,
    kind: record.kind,
    contentDigest: record.contentDigest,
    provenanceDigest: record.provenanceDigest,
    sourceIdentity: record.sourceIdentity,
    source,
    derivation: record.derivation,
    participants: record.participants,
    sensitivity: record.sensitivity,
    ...(record.correctionProvenance === undefined
      ? {}
      : { correctionProvenance: record.correctionProvenance }),
    ...(record.captureAuditRef === undefined ? {} : { captureAuditRef: record.captureAuditRef }),
    ...(record.conversationSourceKey === undefined
      ? {}
      : { conversationSourceKey: record.conversationSourceKey }),
    flags: record.flags,
  };
};

const identityJson = (record: MaterialRecord): string =>
  canonicalJson(materialIdentitySemantics(record));

const loadMaterialRows = (
  database: DatabaseSync,
  subjectId: SubjectId,
): readonly StoredMaterialRow[] =>
  queryAll(
    database,
    `SELECT materials.material_id, materials.kind, materials.content_digest,
              materials.provenance_digest, materials.source_identity,
              materials.identity_json, materials.record_json, materials.blob_digest,
              materials.stored_at, blobs.byte_length AS blob_byte_length
       FROM materials
       LEFT JOIN blobs ON blobs.digest = materials.blob_digest
       WHERE materials.subject_id = ?
       ORDER BY materials.material_id`,
    [subjectId],
    "subject materials",
  ).map((row) => {
    const recordJson = text(row, "record_json");
    const record = parseStored(
      () => materialRecordSchema.parse(parseJson(recordJson, "material record")),
      "material record",
    ) as MaterialRecord;
    verifyFactChecksum(record);
    const materialId = parseStored(
      () => materialIdSchema.parse(text(row, "material_id")),
      "material id",
    );
    const kind = text(row, "kind") as MaterialRecord["kind"];
    const contentDigest = parseStored(
      () => contentDigestSchema.parse(text(row, "content_digest")),
      "content digest",
    );
    const provenanceDigest = parseStored(
      () => provenanceDigestSchema.parse(text(row, "provenance_digest")),
      "provenance digest",
    );
    const sourceIdentity = utf8Blob(row, "source_identity");
    const storedIdentityJson = text(row, "identity_json");
    const blobDigest = parseStored(
      () => contentDigestSchema.parse(text(row, "blob_digest")),
      "blob digest",
    );
    const blobByteLength = integer(row, "blob_byte_length");
    const storedAt = parseStored(
      () => isoDateTimeSchema.parse(text(row, "stored_at")),
      "stored timestamp",
    );
    if (
      record.id !== materialId ||
      record.kind !== kind ||
      record.subjectId !== subjectId ||
      record.contentDigest !== contentDigest ||
      record.provenanceDigest !== provenanceDigest ||
      record.sourceIdentity !== sourceIdentity ||
      record.storedAt !== storedAt ||
      blobDigest !== contentDigest ||
      canonicalJson(record) !== recordJson ||
      digestMaterialProvenance(record) !== provenanceDigest ||
      deriveMaterialId(sourceIdentity, provenanceDigest, contentDigest) !== materialId ||
      identityJson(record) !== storedIdentityJson
    ) {
      throw storageCorrupt("SQLite material columns disagree with its canonical record.");
    }
    return {
      materialId,
      kind,
      contentDigest,
      provenanceDigest,
      sourceIdentity,
      identityJson: storedIdentityJson,
      record,
      blobDigest,
      blobByteLength,
      storedAt,
    };
  });

const loadPending = (
  database: DatabaseSync,
  subjectId: SubjectId,
): PendingJobMarker | undefined => {
  const row = queryOne(
    database,
    `SELECT job_id, generation, base_version_id, material_set_hash,
              added_material_count, total_material_count, queued_at
       FROM pending_jobs
       WHERE subject_id = ?`,
    [subjectId],
    "a pending job",
  );
  if (row === undefined) return undefined;
  const baseVersionId = nullableText(row, "base_version_id");
  return {
    jobId: parseStored(() => jobIdSchema.parse(text(row, "job_id")), "job id"),
    generation: integer(row, "generation"),
    ...(baseVersionId === undefined
      ? {}
      : {
          baseVersionId: parseStored(
            () => versionIdSchema.parse(baseVersionId),
            "pending base version id",
          ),
        }),
    materialSetHash: parseStored(
      () => materialSetHashSchema.parse(text(row, "material_set_hash")),
      "material-set hash",
    ),
    addedMaterialCount: integer(row, "added_material_count"),
    totalMaterialCount: integer(row, "total_material_count"),
    queuedAt: parseStored(
      () => isoDateTimeSchema.parse(text(row, "queued_at")),
      "queued timestamp",
    ),
  };
};

const loadState = (
  database: DatabaseSync,
  subjectId: SubjectId,
): { readonly state: SubjectStateRecord; readonly rows: readonly StoredMaterialRow[] } => {
  const row = queryOne(
    database,
    `SELECT generation, material_set_hash, current_version_id, suspended_version_id
       FROM subject_states
       WHERE subject_id = ?`,
    [subjectId],
    "subject state",
  );
  if (row === undefined) {
    const exists = queryOne(
      database,
      "SELECT 1 FROM subjects WHERE id = ?",
      [subjectId],
      "subject existence",
    );
    if (exists === undefined) throw factNotFound("The requested subject does not exist.");
    throw storageCorrupt("A subject is missing its authoritative state row.");
  }
  const rows = loadMaterialRows(database, subjectId);
  const materialManifest = rows.map((material) => ({
    materialId: material.materialId,
    contentDigest: material.contentDigest,
    provenanceDigest: material.provenanceDigest,
  }));
  const storedHash = nullableText(row, "material_set_hash");
  if (materialManifest.length === 0 && storedHash !== undefined) {
    throw storageCorrupt("An empty subject has a material-set hash.");
  }
  if (materialManifest.length > 0 && storedHash !== hashMaterialSet(materialManifest)) {
    throw storageCorrupt("The subject material-set hash does not match its material rows.");
  }
  const pending = loadPending(database, subjectId);
  const currentVersionId = nullableText(row, "current_version_id");
  const suspendedVersionId = nullableText(row, "suspended_version_id");
  if (currentVersionId !== undefined || suspendedVersionId !== undefined) {
    throw storageCorrupt("SQLite v1 cannot contain version pointers before version storage lands.");
  }
  const state = parseStored(
    () =>
      subjectStateRecordSchema.parse(
        sealFact<SubjectStateRecord>({
          schemaVersion: 2,
          subjectId,
          generation: integer(row, "generation"),
          ...(storedHash === undefined
            ? {}
            : {
                materialSetHash: parseStored(
                  () => materialSetHashSchema.parse(storedHash),
                  "material-set hash",
                ),
              }),
          materialManifest,
          ...(currentVersionId === undefined
            ? {}
            : {
                currentVersionId: parseStored(
                  () => versionIdSchema.parse(currentVersionId),
                  "current version id",
                ),
              }),
          ...(suspendedVersionId === undefined
            ? {}
            : {
                suspendedVersionId: parseStored(
                  () => versionIdSchema.parse(suspendedVersionId),
                  "suspended version id",
                ),
              }),
          ...(pending === undefined ? {} : { pending }),
        }),
      ),
    "subject state",
  ) as SubjectStateRecord;
  if (
    currentVersionId === undefined &&
    pending !== undefined &&
    (pending.baseVersionId !== undefined ||
      pending.addedMaterialCount !== materialManifest.length ||
      pending.totalMaterialCount !== materialManifest.length)
  ) {
    throw storageCorrupt("A pending job disagrees with its empty-version material baseline.");
  }
  return { state, rows };
};

const classifyBatch = (
  existing: readonly StoredMaterialRow[],
  prepared: readonly PreparedMaterial[],
  publishedBlobs: ReadonlyMap<ContentDigest, BlobPutResult>,
): PreparedBatch => {
  const existingById = new Map(existing.map((material) => [material.materialId, material]));
  const seen = new Map<MaterialId, PreparedMaterial>();
  const accepted: PreparedMaterial[] = [];
  const items: IngestItemResult[] = [];
  const storedAtByMaterialId = new Map(existing.map((row) => [row.materialId, row.storedAt]));

  for (const material of prepared) {
    const duplicateInBatch = seen.get(material.record.id);
    const stored = existingById.get(material.record.id);
    let kind: IngestItemResult["kind"];
    if (duplicateInBatch !== undefined) {
      if (
        duplicateInBatch.content !== material.content ||
        identityJson(duplicateInBatch.record) !== identityJson(material.record)
      ) {
        throw storageCorrupt("One material id resolved to conflicting batch semantics.");
      }
      kind = "duplicate";
    } else if (stored !== undefined) {
      const published = publishedBlobs.get(material.record.contentDigest);
      if (
        published === undefined ||
        stored.blobByteLength !== published.byteLength ||
        stored.contentDigest !== material.record.contentDigest ||
        stored.provenanceDigest !== material.record.provenanceDigest ||
        stored.sourceIdentity !== material.record.sourceIdentity ||
        stored.blobDigest !== material.record.contentDigest ||
        stored.identityJson !== identityJson(material.record)
      ) {
        throw storageCorrupt("A stored material id resolves to conflicting identity semantics.");
      }
      seen.set(material.record.id, material);
      kind = "duplicate";
    } else {
      seen.set(material.record.id, material);
      accepted.push(material);
      storedAtByMaterialId.set(material.record.id, material.record.storedAt);
      kind = "accepted";
    }
    items.push({
      clientRef: material.clientRef,
      kind,
      materialId: material.record.id,
      contentDigest: material.record.contentDigest,
    });
  }

  const targetManifest = [
    ...existing.map((row) => ({
      materialId: row.materialId,
      contentDigest: row.contentDigest,
      provenanceDigest: row.provenanceDigest,
    })),
    ...accepted.map(({ record }) => ({
      materialId: record.id,
      contentDigest: record.contentDigest,
      provenanceDigest: record.provenanceDigest,
    })),
  ].sort((left, right) =>
    left.materialId < right.materialId ? -1 : left.materialId > right.materialId ? 1 : 0,
  );
  return { accepted, items, targetManifest, storedAtByMaterialId };
};

const writePending = (
  database: DatabaseSync,
  subjectId: SubjectId,
  pending: PendingJobMarker | undefined,
): void => {
  database.prepare("DELETE FROM pending_jobs WHERE subject_id = ?").run(subjectId);
  if (pending === undefined) return;
  database
    .prepare(
      `INSERT INTO pending_jobs(
         subject_id, job_id, generation, base_version_id, material_set_hash,
         added_material_count, total_material_count, queued_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      subjectId,
      pending.jobId,
      pending.generation,
      pending.baseVersionId ?? null,
      pending.materialSetHash,
      pending.addedMaterialCount,
      pending.totalMaterialCount,
      pending.queuedAt,
    );
};

/** Atomic SQLite/WAL text ingest below the public EngineClient boundary. */
export class IngestService {
  readonly #dependencies: IngestServiceDependencies;

  /**
   * Creates the SQLite-backed ingest mutation.
   *
   * @param dependencies - SQLite, blob, identity, clock, and event seams.
   */
  constructor(dependencies: IngestServiceDependencies) {
    this.#dependencies = dependencies;
  }

  /**
   * Performs one globally keyed atomic text ingest.
   *
   * @param rawInput - Untrusted method parameters parsed at this boundary.
   * @param rawActor - Trusted actor attached by the calling client composition.
   * @param rawMutation - Caller-owned RequestId retained across retries.
   * @returns The exact stored ingest result on first execution or replay.
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
    if (
      normalizedMaterials.some(
        (material) =>
          material.derivation.kind === "host_extract" &&
          material.derivation.method === "computer_use_transcript",
      )
    ) {
      throw invalidInput(
        "Computer-use transcripts require a trusted private capture session.",
        "materials.derivation.method",
      );
    }
    const inputChecksum = computeMutationInputChecksum(
      "materials.ingest",
      { subject: canonicalTarget, materials: normalizedMaterials, enqueue: input.enqueue },
      actor,
    );
    const replay = this.#dependencies.store.read((database) =>
      replayCompletedMutation(database, {
        requestId: mutation.requestId,
        method: "materials.ingest",
        inputChecksum,
        actor,
      }),
    );
    if (replay !== undefined) return replay;

    const candidateSubjectId =
      canonicalTarget.kind === "existing"
        ? canonicalTarget.subjectId
        : this.#dependencies.ids.subjectId();
    const now = this.#dependencies.clock.now();
    const prepared = normalizedMaterials.map((material) =>
      prepareMaterial(material, candidateSubjectId, mutation.requestId, now),
    );
    const uniqueContent = new Map<ContentDigest, PreparedMaterial>();
    for (const material of prepared) {
      const previous = uniqueContent.get(material.record.contentDigest);
      if (previous !== undefined && previous.content !== material.content) {
        throw storageCorrupt("One content digest resolved to conflicting batch bytes.");
      }
      uniqueContent.set(material.record.contentDigest, material);
    }

    const outcome = await (async (): Promise<TransactionOutcome> => {
      const blobAccess = await this.#dependencies.blobs.acquireMutationAccess();
      try {
        const blobRowsBeforePublish = this.#dependencies.store.read((database) => {
          const existing = new Set<ContentDigest>();
          for (const digest of uniqueContent.keys()) {
            const row = queryOne(
              database,
              `SELECT
                 EXISTS(SELECT 1 FROM blobs WHERE digest = ?) AS blob_present,
                 EXISTS(SELECT 1 FROM materials WHERE blob_digest = ?) AS material_present`,
              [digest, digest],
              "pre-publish blob references",
            );
            if (row === undefined) {
              throw storageCorrupt("SQLite did not return a blob-reference snapshot.");
            }
            const blobPresent = sqliteBoolean(row, "blob_present");
            const materialPresent = sqliteBoolean(row, "material_present");
            if (materialPresent && !blobPresent) {
              throw storageCorrupt("A material references a missing blob authority row.");
            }
            if (blobPresent) existing.add(digest);
          }
          return existing;
        });
        const publishedBlobs = new Map<ContentDigest, BlobPutResult>();
        for (const material of uniqueContent.values()) {
          if (!blobRowsBeforePublish.has(material.record.contentDigest)) continue;
          const verified = await blobAccess.verify(material.record.contentDigest, material.content);
          if (verified === undefined) {
            throw storageCorrupt("A referenced content blob is missing from local storage.");
          }
          publishedBlobs.set(verified.digest, verified);
        }
        for (const material of uniqueContent.values()) {
          if (publishedBlobs.has(material.record.contentDigest)) continue;
          const published = await blobAccess.put(material.record.contentDigest, material.content);
          publishedBlobs.set(published.digest, published);
          await this.#dependencies.hooks?.afterBlobPut?.(material.record.contentDigest);
        }
        return this.#dependencies.store.write((database) => {
          const storedReplay = replayCompletedMutation(database, {
            requestId: mutation.requestId,
            method: "materials.ingest",
            inputChecksum,
            actor,
          });
          if (storedReplay !== undefined) {
            return { result: storedReplay, events: [], committed: false };
          }
          return this.#commit(
            database,
            input,
            actor,
            mutation,
            canonicalTarget,
            candidateSubjectId,
            prepared,
            blobRowsBeforePublish,
            publishedBlobs,
            inputChecksum,
            now,
          );
        });
      } finally {
        await blobAccess.release();
      }
    })();
    if (outcome.committed) {
      await this.#dependencies.hooks?.afterTransactionCommit?.(mutation.requestId);
      for (const event of outcome.events) await this.#dependencies.eventBus.publish(event);
    }
    return outcome.result;
  }

  #commit(
    database: DatabaseSync,
    input: IngestInput,
    actor: ActorContext,
    mutation: MutationContext,
    target: NormalizedIngestSubjectTarget,
    candidateSubjectId: SubjectId,
    prepared: readonly PreparedMaterial[],
    blobRowsBeforePublish: ReadonlySet<ContentDigest>,
    publishedBlobs: ReadonlyMap<ContentDigest, BlobPutResult>,
    inputChecksum: FactChecksum,
    now: IsoDateTime,
  ): TransactionOutcome {
    const created = target.kind === "create";
    const subject =
      target.kind === "existing"
        ? loadSubjectSummaryInTransaction(database, target.subjectId)
        : createSubjectIdentityInTransaction(
            database,
            target.input,
            this.#dependencies.ids,
            candidateSubjectId,
          );
    const previous = loadState(database, subject.id);
    const batch = classifyBatch(previous.rows, prepared, publishedBlobs);
    if (previous.state.currentVersionId !== undefined) {
      throw storageCorrupt("A current version cannot exist before version storage is migrated.");
    }
    const derived = deriveIngestState({
      subjectId: subject.id,
      previous: previous.state,
      targetManifest: batch.targetManifest,
      storedAtByMaterialId: batch.storedAtByMaterialId,
      enqueue: input.enqueue,
      now,
      nextJobId: () => this.#dependencies.ids.jobId(),
    });
    if (derived.state.materialSetHash === undefined) {
      throw storageCorrupt("A non-empty ingest target is missing its material-set hash.");
    }

    for (const material of batch.accepted) {
      const published = publishedBlobs.get(material.record.contentDigest);
      if (published === undefined) throw storageCorrupt("A material blob was not published.");
      let blobRow = queryOne(
        database,
        "SELECT byte_length FROM blobs WHERE digest = ?",
        [material.record.contentDigest],
        "a blob authority row",
      );
      if (blobRow === undefined) {
        const dependent = queryOne(
          database,
          "SELECT 1 AS present FROM materials WHERE blob_digest = ? LIMIT 1",
          [material.record.contentDigest],
          "material references to a blob",
        );
        if (blobRowsBeforePublish.has(material.record.contentDigest) || dependent !== undefined) {
          throw storageCorrupt("A referenced blob authority row disappeared before commit.");
        }
        database
          .prepare(
            `INSERT INTO blobs(digest, byte_length)
             VALUES (?, ?)`,
          )
          .run(material.record.contentDigest, published.byteLength);
        blobRow = queryOne(
          database,
          "SELECT byte_length FROM blobs WHERE digest = ?",
          [material.record.contentDigest],
          "a newly inserted blob authority row",
        );
      }
      if (blobRow === undefined || integer(blobRow, "byte_length") !== published.byteLength) {
        throw storageCorrupt("A blob authority row conflicts with immutable bytes.");
      }
      database
        .prepare(
          `INSERT INTO materials(
             subject_id, material_id, kind, content_digest, provenance_digest,
             source_identity, identity_json, record_json, blob_digest, stored_at
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          subject.id,
          material.record.id,
          material.record.kind,
          material.record.contentDigest,
          material.record.provenanceDigest,
          Buffer.from(material.record.sourceIdentity, "utf8"),
          identityJson(material.record),
          canonicalJson(material.record),
          material.record.contentDigest,
          material.record.storedAt,
        );
    }

    database
      .prepare(
        `UPDATE subject_states
         SET generation = ?, material_set_hash = ?
         WHERE subject_id = ?`,
      )
      .run(derived.state.generation, derived.state.materialSetHash, subject.id);
    writePending(database, subject.id, derived.state.pending);

    const resultSubject: SubjectSummary = {
      ...subject,
      ...(derived.state.currentVersionId === undefined
        ? {}
        : { currentVersionId: derived.state.currentVersionId }),
    };
    const result: IngestResult =
      batch.accepted.length === 0
        ? {
            kind: "unchanged",
            subject: resultSubject,
            items: batch.items,
            materialSetHash: derived.state.materialSetHash,
            generation: derived.state.generation,
            ...(derived.job === undefined ? {} : { job: derived.job }),
          }
        : {
            kind: "ingested",
            subject: resultSubject,
            created,
            items: batch.items,
            materialSetHash: derived.state.materialSetHash,
            generation: derived.state.generation,
            ...(derived.job === undefined ? {} : { job: derived.job }),
          };
    const parsedResult = parseStored(
      () => ingestResultSchema.parse(result),
      "ingest result",
    ) as IngestResult;
    insertCompletedOperationInTransaction(database, {
      requestId: mutation.requestId,
      method: "materials.ingest",
      subjectId: subject.id,
      actor,
      inputChecksum,
      result: parsedResult,
      completedAt: now,
    });

    const events: EngineEvent[] = [];
    if (created) events.push({ kind: "subject.created", subjectId: subject.id, at: now });
    if (batch.accepted.length > 0) {
      events.push({ kind: "material.ingested", subjectId: subject.id, at: now });
    }
    if (derived.pendingChanged) {
      events.push({ kind: "job.changed", subjectId: subject.id, at: now });
    }
    for (const event of events) {
      insertEventInTransaction(database, {
        eventId: this.#dependencies.ids.eventId(),
        event,
        actor,
        requestId: mutation.requestId,
      });
    }
    this.#dependencies.hooks?.beforeTransactionCommit?.(mutation.requestId);
    return { result: parsedResult, events, committed: true };
  }
}
