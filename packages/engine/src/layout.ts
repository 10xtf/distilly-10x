import { isAbsolute, relative, resolve, sep } from "node:path";

import {
  eventIdSchema,
  materialIdSchema,
  requestIdSchema,
  spaceIdSchema,
  subjectIdSchema,
  versionIdSchema,
} from "@distilly/protocol";
import type {
  EventId,
  MaterialId,
  RequestId,
  SpaceId,
  SubjectId,
  VersionId,
} from "@distilly/protocol";

import { invalidInput } from "./internal-errors.js";

/** Deterministic paths under one configured Distilly fact root. */
export class Layout {
  readonly root: string;

  /**
   * Creates a confined layout rooted at an absolute local path.
   *
   * @param root - Local fact root that confines every derived path.
   */
  constructor(root: string) {
    if (root.trim().length === 0) throw invalidInput("DISTILLY_ROOT cannot be empty.", "root");
    this.root = resolve(root);
  }

  /**
   * Root directory containing space records.
   *
   * @returns The absolute spaces directory path.
   */
  spacesDirectory(): string {
    return this.inside("spaces");
  }

  /**
   * Root directory containing subject facts.
   *
   * @returns The absolute subjects directory path.
   */
  subjectsDirectory(): string {
    return this.inside("subjects");
  }

  /**
   * Root directory containing globally keyed operation facts.
   *
   * @returns The absolute operations directory path.
   */
  operationsDirectory(): string {
    return this.inside("operations");
  }

  /**
   * Root directory containing transaction journals.
   *
   * @returns The absolute transactions directory path.
   */
  transactionsDirectory(): string {
    return this.inside("transactions");
  }

  /**
   * Root directory containing disposable indexes.
   *
   * @returns The absolute index directory path.
   */
  indexDirectory(): string {
    return this.inside(".index");
  }

  /**
   * Path of one space record.
   *
   * @param spaceId - Space identifier used as the file name.
   * @returns The confined absolute space-record path.
   */
  spaceFile(spaceId: SpaceId): string {
    return this.inside("spaces", `${spaceIdSchema.parse(spaceId)}.json`);
  }

  /**
   * Cross-process identity lock for one space.
   *
   * @param spaceId - Space whose identity mutation is serialized.
   * @returns The confined absolute identity-lock path.
   */
  spaceIdentityLock(spaceId: SpaceId): string {
    return this.inside("spaces", `${spaceIdSchema.parse(spaceId)}.identity.lock`);
  }

  /**
   * Global catalog lock used while resolving or creating an inline space.
   *
   * @returns The confined absolute catalog-lock path.
   */
  spaceCatalogLock(): string {
    return this.inside("spaces", ".catalog.lock");
  }

  /**
   * Directory containing one subject's facts.
   *
   * @param subjectId - Subject whose fact directory is requested.
   * @returns The confined absolute subject-directory path.
   */
  subjectDirectory(subjectId: SubjectId): string {
    return this.inside("subjects", subjectIdSchema.parse(subjectId));
  }

  /**
   * Candidate-safe subject lock that exists before the subject directory.
   *
   * @param subjectId - Subject whose mutation is serialized.
   * @returns The confined absolute subject-lock path.
   */
  subjectLock(subjectId: SubjectId): string {
    return this.inside("subjects", ".locks", `${subjectIdSchema.parse(subjectId)}.lock`);
  }

  /**
   * Fixed create-and-first-ingest staging directory named by its journal.
   *
   * @param requestId - Journal request that owns the staging directory.
   * @param subjectId - Candidate subject staged for publication.
   * @returns The confined absolute staging-directory path.
   */
  ingestStagingDirectory(requestId: RequestId, subjectId: SubjectId): string {
    return this.inside(
      "subjects",
      ".staging",
      `${requestIdSchema.parse(requestId)}.${subjectIdSchema.parse(subjectId)}`,
    );
  }

  /**
   * Subject record inside one fixed ingest staging directory.
   *
   * @param requestId - Journal request that owns the staging directory.
   * @param subjectId - Candidate subject staged for publication.
   * @returns The absolute staged subject-record path.
   */
  stagedSubjectFile(requestId: RequestId, subjectId: SubjectId): string {
    return resolve(this.ingestStagingDirectory(requestId, subjectId), "subject.json");
  }

  /**
   * State record inside one fixed ingest staging directory.
   *
   * @param requestId - Journal request that owns the staging directory.
   * @param subjectId - Candidate subject staged for publication.
   * @returns The absolute staged state-record path.
   */
  stagedStateFile(requestId: RequestId, subjectId: SubjectId): string {
    return resolve(this.ingestStagingDirectory(requestId, subjectId), "state.json");
  }

  /**
   * One material directory inside a fixed ingest staging directory.
   *
   * @param requestId - Journal request that owns the staging directory.
   * @param subjectId - Candidate subject staged for publication.
   * @param materialId - Staged material identifier.
   * @returns The absolute staged material-directory path.
   */
  stagedMaterialDirectory(
    requestId: RequestId,
    subjectId: SubjectId,
    materialId: MaterialId,
  ): string {
    return resolve(
      this.ingestStagingDirectory(requestId, subjectId),
      "knowledge",
      "materials",
      materialIdSchema.parse(materialId),
    );
  }

  /**
   * Material record inside a fixed ingest staging directory.
   *
   * @param requestId - Journal request that owns the staging directory.
   * @param subjectId - Candidate subject staged for publication.
   * @param materialId - Staged material identifier.
   * @returns The absolute staged material-record path.
   */
  stagedMaterialFile(requestId: RequestId, subjectId: SubjectId, materialId: MaterialId): string {
    return resolve(this.stagedMaterialDirectory(requestId, subjectId, materialId), "material.json");
  }

  /**
   * Material body inside a fixed ingest staging directory.
   *
   * @param requestId - Journal request that owns the staging directory.
   * @param subjectId - Candidate subject staged for publication.
   * @param materialId - Staged material identifier.
   * @returns The absolute staged material-content path.
   */
  stagedMaterialContentFile(
    requestId: RequestId,
    subjectId: SubjectId,
    materialId: MaterialId,
  ): string {
    return resolve(this.stagedMaterialDirectory(requestId, subjectId, materialId), "content.txt");
  }

  /**
   * Path of one subject identity record.
   *
   * @param subjectId - Subject whose identity record is requested.
   * @returns The confined absolute subject-record path.
   */
  subjectFile(subjectId: SubjectId): string {
    return this.inside("subjects", subjectIdSchema.parse(subjectId), "subject.json");
  }

  /**
   * Path of one authoritative subject state record.
   *
   * @param subjectId - Subject whose current state is requested.
   * @returns The confined absolute state-record path.
   */
  stateFile(subjectId: SubjectId): string {
    return this.inside("subjects", subjectIdSchema.parse(subjectId), "state.json");
  }

  /**
   * Directory containing one immutable material and its text.
   *
   * @param subjectId - Subject that owns the material.
   * @param materialId - Material identifier used as the directory name.
   * @returns The confined absolute material-directory path.
   */
  materialDirectory(subjectId: SubjectId, materialId: MaterialId): string {
    return this.inside(
      "subjects",
      subjectIdSchema.parse(subjectId),
      "knowledge",
      "materials",
      materialIdSchema.parse(materialId),
    );
  }

  /**
   * Path of one immutable material record.
   *
   * @param subjectId - Subject that owns the material.
   * @param materialId - Material whose record is requested.
   * @returns The confined absolute material-record path.
   */
  materialFile(subjectId: SubjectId, materialId: MaterialId): string {
    return this.inside(
      "subjects",
      subjectIdSchema.parse(subjectId),
      "knowledge",
      "materials",
      materialIdSchema.parse(materialId),
      "material.json",
    );
  }

  /**
   * Path of one immutable material body.
   *
   * @param subjectId - Subject that owns the material.
   * @param materialId - Material whose text is requested.
   * @returns The confined absolute material-content path.
   */
  materialContentFile(subjectId: SubjectId, materialId: MaterialId): string {
    return this.inside(
      "subjects",
      subjectIdSchema.parse(subjectId),
      "knowledge",
      "materials",
      materialIdSchema.parse(materialId),
      "content.txt",
    );
  }

  /**
   * Path of one immutable event record.
   *
   * @param subjectId - Subject that owns the event.
   * @param eventId - Event identifier used as the file name.
   * @returns The confined absolute event-record path.
   */
  eventFile(subjectId: SubjectId, eventId: EventId): string {
    return this.inside(
      "subjects",
      subjectIdSchema.parse(subjectId),
      "events",
      `${eventIdSchema.parse(eventId)}.json`,
    );
  }

  /**
   * Path of one globally keyed completed operation or purge tombstone.
   *
   * @param requestId - Globally unique request identifier.
   * @returns The confined absolute operation-fact path.
   */
  operationFile(requestId: RequestId): string {
    return this.inside("operations", `${requestIdSchema.parse(requestId)}.json`);
  }

  /**
   * Cross-process lock for one globally unique request id.
   *
   * @param requestId - Globally unique request identifier.
   * @returns The confined absolute request-lock path.
   */
  requestLock(requestId: RequestId): string {
    return this.inside("operations", ".locks", `${requestIdSchema.parse(requestId)}.lock`);
  }

  /**
   * Path of one root transaction journal.
   *
   * @param requestId - Journal request identifier.
   * @returns The confined absolute transaction-record path.
   */
  transactionFile(requestId: RequestId): string {
    return this.inside("transactions", `${requestIdSchema.parse(requestId)}.json`);
  }

  /**
   * Directory containing one immutable profile version.
   *
   * @param subjectId - Subject that owns the version.
   * @param versionId - Immutable profile version identifier.
   * @returns The confined absolute version-directory path.
   */
  versionDirectory(subjectId: SubjectId, versionId: VersionId): string {
    return this.inside(
      "subjects",
      subjectIdSchema.parse(subjectId),
      "versions",
      versionIdSchema.parse(versionId),
    );
  }

  /**
   * Path of immutable metadata for one profile version.
   *
   * @param subjectId - Subject that owns the version.
   * @param versionId - Immutable profile version identifier.
   * @returns The absolute version-record path.
   */
  versionFile(subjectId: SubjectId, versionId: VersionId): string {
    return resolve(this.versionDirectory(subjectId, versionId), "version.json");
  }

  /**
   * Path of the immutable material manifest for one profile version.
   *
   * @param subjectId - Subject that owns the version.
   * @param versionId - Immutable profile version identifier.
   * @returns The absolute version-material-manifest path.
   */
  versionMaterialManifestFile(subjectId: SubjectId, versionId: VersionId): string {
    return resolve(this.versionDirectory(subjectId, versionId), "materials.json");
  }

  /**
   * Path of the immutable claims snapshot for one profile version.
   *
   * @param subjectId - Subject that owns the version.
   * @param versionId - Immutable profile version identifier.
   * @returns The absolute version-claims-snapshot path.
   */
  versionClaimsFile(subjectId: SubjectId, versionId: VersionId): string {
    return resolve(this.versionDirectory(subjectId, versionId), "claims.json");
  }

  /**
   * Path of the disposable queue database.
   *
   * @returns The confined absolute queue-database path.
   */
  queueDatabaseFile(): string {
    return this.inside(".index", "queue.db");
  }

  /**
   * Path of the fixed-byte queue projection dirty marker.
   *
   * @returns The confined absolute queue-dirty-marker path.
   */
  queueDirtyFile(): string {
    return this.inside(".index", "queue.dirty");
  }

  /**
   * Verifies that a derived path remains below this root.
   *
   * @param path - Candidate path to validate against the configured root.
   */
  assertInside(path: string): void {
    const absolute = resolve(path);
    const fromRoot = relative(this.root, absolute);
    if (
      fromRoot === "" ||
      (!fromRoot.startsWith(`..${sep}`) && fromRoot !== ".." && !isAbsolute(fromRoot))
    ) {
      return;
    }
    throw invalidInput("Fact path escapes DISTILLY_ROOT.");
  }

  private inside(...segments: readonly string[]): string {
    const path = resolve(this.root, ...segments);
    this.assertInside(path);
    return path;
  }
}
