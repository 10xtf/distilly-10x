import { DistillyError } from "@distilly/protocol";
import type {
  SpaceRecord,
  SubjectId,
  SubjectRecord,
  SubjectStateRecord,
  SubjectSummary,
} from "@distilly/protocol";
import { BUILTIN_PEOPLE_SPACE_ID } from "@distilly/protocol";

import type { FileSpaceStore } from "../facts/space-store.js";
import type { FileStateStore } from "../facts/state-store.js";
import type { FileSubjectStore } from "../facts/subject-store.js";
import { sealFact } from "../facts/checksum.js";
import { ambiguousSubject, storageCorrupt, subjectAlreadyExists } from "../internal-errors.js";
import type { IdGenerator } from "../ports/id-generator.js";
import type { FileSpaceCatalogLock } from "../transaction/space-catalog-lock.js";
import type { FileSpaceIdentityLock } from "../transaction/space-identity-lock.js";
import type { NormalizedCreateSubjectInput } from "./identity.js";
import { findCreateConflict } from "./identity.js";

const BUILTIN_PEOPLE_RECORD = sealFact<SpaceRecord>({
  schemaVersion: 1,
  id: BUILTIN_PEOPLE_SPACE_ID,
  displayName: "People",
  kind: "people",
});

/**
 * Projects verified subject, space, and state facts into the public identity summary.
 *
 * @param subject - Verified subject identity fact.
 * @param space - Verified owning space fact.
 * @param state - Verified authoritative state.
 * @returns The complete public identity summary.
 */
export const summarizeSubject = (
  subject: SubjectRecord,
  space: SpaceRecord,
  state: SubjectStateRecord,
): SubjectSummary => ({
  id: subject.id,
  displayName: subject.displayName,
  aliases: subject.aliases,
  identityHints: subject.identityHints,
  space: { id: space.id, displayName: space.displayName, kind: space.kind },
  lifecycle: subject.lifecycle,
  ...(state.currentVersionId === undefined ? {} : { currentVersionId: state.currentVersionId }),
});

const readStateForSubject = async (
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

/** Subject identity operations that remain below the public EngineClient boundary. */
export class SubjectService {
  readonly #spaces: FileSpaceStore;
  readonly #subjects: FileSubjectStore;
  readonly #states: FileStateStore;
  readonly #spaceCatalogLock: FileSpaceCatalogLock;
  readonly #spaceIdentityLock: FileSpaceIdentityLock;
  readonly #ids: IdGenerator;

  /**
   * Creates the package-internal subject identity service.
   *
   * @param spaces - Immutable space fact store.
   * @param subjects - Subject identity fact store.
   * @param states - Authoritative subject state store.
   * @param spaceCatalogLock - Global inline-space resolver lock.
   * @param spaceIdentityLock - Per-space subject identity lock.
   * @param ids - Trusted cryptographic id generator.
   */
  constructor(
    spaces: FileSpaceStore,
    subjects: FileSubjectStore,
    states: FileStateStore,
    spaceCatalogLock: FileSpaceCatalogLock,
    spaceIdentityLock: FileSpaceIdentityLock,
    ids: IdGenerator,
  ) {
    this.#spaces = spaces;
    this.#subjects = subjects;
    this.#states = states;
    this.#spaceCatalogLock = spaceCatalogLock;
    this.#spaceIdentityLock = spaceIdentityLock;
    this.#ids = ids;
  }

  /**
   * Resolves or creates the target space before taking its identity lock.
   *
   * @param input - Canonical create target.
   * @returns The exact persisted space fact.
   */
  async resolveCreateSpace(input: NormalizedCreateSubjectInput): Promise<SpaceRecord> {
    if (input.space.kind === "existing") return this.#spaces.read(input.space.spaceId);
    if (input.space.kind === "builtin_people") {
      const lease = await this.#spaceIdentityLock.acquire(BUILTIN_PEOPLE_SPACE_ID);
      try {
        await this.#spaces.write(BUILTIN_PEOPLE_RECORD);
      } finally {
        await lease.release();
      }
      return this.#spaces.read(BUILTIN_PEOPLE_SPACE_ID);
    }

    const inlineSpace = input.space;
    const lease = await this.#spaceCatalogLock.acquire();
    try {
      const matches = (await this.#spaces.list()).filter(
        (space) =>
          space.kind === inlineSpace.spaceKind && space.displayName === inlineSpace.displayName,
      );
      if (matches.length > 1) {
        throw storageCorrupt("More than one space owns the same canonical kind and label.");
      }
      if (matches.length === 1) return matches[0]!;
      const record = sealFact<SpaceRecord>({
        schemaVersion: 1,
        id: this.#ids.spaceId(),
        displayName: inlineSpace.displayName,
        kind: inlineSpace.spaceKind,
      });
      await this.#spaces.write(record);
      return record;
    } finally {
      await lease.release();
    }
  }

  /**
   * Re-runs deterministic duplicate detection under the caller-held space identity lock.
   *
   * @param input - Canonical create target.
   * @param space - Resolved immutable space fact.
   */
  async assertCreateAvailable(
    input: NormalizedCreateSubjectInput,
    space: SpaceRecord,
  ): Promise<void> {
    const summaries: SubjectSummary[] = [];
    for (const subject of await this.#subjects.listBySpace(space.id)) {
      summaries.push(await this.toSummary(subject, space));
    }
    const conflict = findCreateConflict(input, summaries);
    if (conflict.kind === "already_exists") throw subjectAlreadyExists(conflict.subject);
    if (conflict.kind === "ambiguous") {
      const [first, second, ...rest] = conflict.candidates;
      if (first === undefined || second === undefined) {
        throw storageCorrupt("An ambiguous subject result requires at least two candidates.");
      }
      throw ambiguousSubject([first, second, ...rest]);
    }
  }

  /**
   * Builds the immutable identity fact for an approved candidate id.
   *
   * @param input - Canonical create fields.
   * @param space - Resolved space that owns the subject.
   * @param subjectId - Preallocated candidate id retained across retries.
   * @returns The sealed subject fact.
   */
  createRecord(
    input: NormalizedCreateSubjectInput,
    space: SpaceRecord,
    subjectId: SubjectId,
  ): SubjectRecord {
    return sealFact<SubjectRecord>({
      schemaVersion: 1,
      id: subjectId,
      spaceId: space.id,
      displayName: input.displayName,
      aliases: input.aliases,
      identityHints: input.identityHints,
      ...(input.domainPack === undefined ? {} : { domainPack: input.domainPack }),
      lifecycle: "active",
    });
  }

  /**
   * Reads a published subject and its owning space/state summary.
   *
   * @param subjectId - Existing subject id.
   * @returns The complete public identity summary.
   */
  async readSummary(subjectId: SubjectId): Promise<SubjectSummary> {
    const subject = await this.#subjects.read(subjectId);
    const space = await this.#spaces.read(subject.spaceId);
    return this.toSummary(subject, space);
  }

  /**
   * Builds a subject summary from a caller-held authoritative state snapshot.
   *
   * @param subjectId - Existing subject id.
   * @param state - Already verified state for the same subject.
   * @returns The complete public identity summary at that state snapshot.
   */
  async readSummaryAtState(
    subjectId: SubjectId,
    state: SubjectStateRecord,
  ): Promise<SubjectSummary> {
    if (state.subjectId !== subjectId) {
      throw storageCorrupt("A subject summary state snapshot belongs to another subject.");
    }
    const subject = await this.#subjects.read(subjectId);
    const space = await this.#spaces.read(subject.spaceId);
    return summarizeSubject(subject, space, state);
  }

  private async toSummary(subject: SubjectRecord, space: SpaceRecord): Promise<SubjectSummary> {
    const state = await readStateForSubject(this.#states, subject.id);
    return summarizeSubject(subject, space, state);
  }
}
