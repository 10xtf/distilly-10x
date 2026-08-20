import { DistillyError, subjectRecordSchema } from "@distilly/protocol";
import type { RuntimeSchema, SubjectId, SubjectRecord } from "@distilly/protocol";

import { storageCorrupt } from "../internal-errors.js";
import { Layout } from "../layout.js";
import { readFactFile, replaceFactFile } from "./fact-file.js";
import type { FileSpaceStore } from "./space-store.js";

const subjectFactSchema: RuntimeSchema<SubjectRecord> = {
  parse(value) {
    return subjectRecordSchema.parse(value) as SubjectRecord;
  },
};

const assertPathId = (requestedId: SubjectId, record: SubjectRecord): void => {
  if (record.id !== requestedId) {
    throw storageCorrupt("Subject record id does not match its fact path.");
  }
};

const requireSpace = async (spaces: FileSpaceStore, record: SubjectRecord): Promise<void> => {
  try {
    await spaces.read(record.spaceId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") {
      throw storageCorrupt("Subject record references a missing space fact.", error);
    }
    throw error;
  }
};

/** Concrete local store for mutable subject identity facts. */
export class FileSubjectStore {
  readonly #layout: Layout;
  readonly #spaces: FileSpaceStore;

  /**
   * Creates a subject store with its required space-fact dependency.
   *
   * @param layout - Confined local fact layout.
   * @param spaces - Store used to validate the subject's space reference.
   */
  constructor(layout: Layout, spaces: FileSpaceStore) {
    this.#layout = layout;
    this.#spaces = spaces;
  }

  /**
   * Atomically writes a subject whose referenced space already exists.
   *
   * @param record - Complete subject fact to publish.
   * @returns Completion after the durable replacement.
   */
  async write(record: SubjectRecord): Promise<void> {
    let parsed: SubjectRecord;
    try {
      parsed = subjectFactSchema.parse(record);
    } catch (error) {
      throw storageCorrupt("Subject fact cannot be written because its schema is invalid.", error);
    }
    await requireSpace(this.#spaces, parsed);
    await replaceFactFile(
      this.#layout.root,
      this.#layout.subjectFile(parsed.id),
      parsed,
      subjectFactSchema,
    );
  }

  /**
   * Reads a subject and verifies its path id and space reference.
   *
   * @param subjectId - Subject whose identity fact should be loaded.
   * @returns The verified persisted record.
   */
  async read(subjectId: SubjectId): Promise<SubjectRecord> {
    const record = await readFactFile(
      this.#layout.root,
      this.#layout.subjectFile(subjectId),
      subjectFactSchema,
    );
    assertPathId(subjectId, record);
    await requireSpace(this.#spaces, record);
    return record;
  }
}
