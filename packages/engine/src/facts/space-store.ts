import type { SpaceId, SpaceRecord } from "@distilly/protocol";
import { spaceRecordSchema } from "@distilly/protocol";

import { storageCorrupt } from "../internal-errors.js";
import { Layout } from "../layout.js";
import { readFactFile, replaceFactFile } from "./fact-file.js";

const assertPathId = (requestedId: SpaceId, record: SpaceRecord): void => {
  if (record.id !== requestedId) {
    throw storageCorrupt("Space record id does not match its fact path.");
  }
};

/** Concrete local store for mutable space identity facts. */
export class FileSpaceStore {
  readonly #layout: Layout;

  /**
   * Creates a space store for one fact layout.
   *
   * @param layout - Confined local fact layout.
   */
  constructor(layout: Layout) {
    this.#layout = layout;
  }

  /**
   * Atomically writes a checksummed space record.
   *
   * @param record - Complete space fact to publish.
   * @returns Completion after the durable replacement.
   */
  async write(record: SpaceRecord): Promise<void> {
    let parsed: SpaceRecord;
    try {
      parsed = spaceRecordSchema.parse(record);
    } catch (error) {
      throw storageCorrupt("Space fact cannot be written because its schema is invalid.", error);
    }
    await replaceFactFile(
      this.#layout.root,
      this.#layout.spaceFile(parsed.id),
      parsed,
      spaceRecordSchema,
    );
  }

  /**
   * Reads and validates one space fact.
   *
   * @param spaceId - Space whose fact should be loaded.
   * @returns The verified persisted record.
   */
  async read(spaceId: SpaceId): Promise<SpaceRecord> {
    const record = await readFactFile(
      this.#layout.root,
      this.#layout.spaceFile(spaceId),
      spaceRecordSchema,
    );
    assertPathId(spaceId, record);
    return record;
  }
}
