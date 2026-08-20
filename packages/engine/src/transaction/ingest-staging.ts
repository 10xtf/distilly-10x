import {
  DistillyError,
  WIRE_LIMITS,
  materialRecordSchema,
  subjectRecordSchema,
  subjectStateRecordSchema,
} from "@distilly/protocol";
import type {
  MaterialRecord,
  RequestId,
  RuntimeSchema,
  SubjectId,
  SubjectRecord,
  SubjectStateRecord,
} from "@distilly/protocol";
import { lstat, rm } from "node:fs/promises";
import { dirname, join } from "node:path";

import { storageCorrupt } from "../internal-errors.js";
import type { Layout } from "../layout.js";
import {
  atomicCreateDirectory,
  atomicCreateFile,
  createPrivateDirectoryExclusive,
  ensurePrivateDirectory,
  publishDirectoryNoReplace,
  syncDirectory,
} from "../facts/atomic-write.js";
import { verifyFactChecksum } from "../facts/checksum.js";
import { listFactDirectory } from "../facts/directory-scan.js";
import { hashMaterialSet, verifyMaterialIdentity } from "../facts/digests.js";
import { createFactFile, readFactFile } from "../facts/fact-file.js";
import { assertNoSymlinkPath, decodeUtf8, isMissing, readRegularFile } from "../facts/safe-fs.js";
import type { FileSpaceStore } from "../facts/space-store.js";

const storedSubjectSchema: RuntimeSchema<SubjectRecord> = {
  parse(value) {
    return subjectRecordSchema.parse(value) as SubjectRecord;
  },
};
const storedStateSchema: RuntimeSchema<SubjectStateRecord> = {
  parse(value) {
    return subjectStateRecordSchema.parse(value) as SubjectStateRecord;
  },
};
const storedMaterialSchema: RuntimeSchema<MaterialRecord> = {
  parse(value) {
    return materialRecordSchema.parse(value) as MaterialRecord;
  },
};

/** One complete material record/body pair placed in create staging. */
interface IngestStagingMaterial {
  readonly record: MaterialRecord;
  readonly content: string;
}

/** Complete facts required before publishing a newly created subject. */
export interface IngestStagingInput {
  readonly subject: SubjectRecord;
  readonly materials: readonly IngestStagingMaterial[];
  readonly state: SubjectStateRecord;
}

const parseFact = <T>(schema: RuntimeSchema<T>, value: T, label: string): T => {
  try {
    const parsed = schema.parse(value);
    verifyFactChecksum(parsed as SubjectRecord | SubjectStateRecord | MaterialRecord);
    return parsed;
  } catch (error) {
    throw storageCorrupt(`${label} is invalid.`, error);
  }
};

const manifestEntryMatches = (
  record: MaterialRecord,
  entry: SubjectStateRecord["materialManifest"][number],
): boolean =>
  record.id === entry.materialId &&
  record.contentDigest === entry.contentDigest &&
  record.provenanceDigest === entry.provenanceDigest;

const validateCompleteInput = (
  input: IngestStagingInput,
): {
  readonly subject: SubjectRecord;
  readonly materials: readonly IngestStagingMaterial[];
  readonly state: SubjectStateRecord;
} => {
  const subject = parseFact(storedSubjectSchema, input.subject, "Staged subject fact");
  const state = parseFact(storedStateSchema, input.state, "Staged state fact");
  if (state.subjectId !== subject.id) {
    throw storageCorrupt("Staged state does not belong to its subject.");
  }

  const materials = input.materials.map(({ record, content }) => {
    const parsed = parseFact(storedMaterialSchema, record, "Staged material fact");
    if (parsed.subjectId !== subject.id) {
      throw storageCorrupt("Staged material does not belong to its subject.");
    }
    if (Buffer.byteLength(content, "utf8") > WIRE_LIMITS.materialContentBytes) {
      throw storageCorrupt("Staged material content exceeds its size limit.");
    }
    verifyMaterialIdentity(parsed, content);
    return { record: parsed, content };
  });

  const byId = new Map(materials.map((material) => [material.record.id, material] as const));
  if (byId.size !== materials.length || state.materialManifest.length !== materials.length) {
    throw storageCorrupt("Staged materials do not exactly match the state manifest.");
  }
  for (const entry of state.materialManifest) {
    const material = byId.get(entry.materialId);
    if (material === undefined || !manifestEntryMatches(material.record, entry)) {
      throw storageCorrupt("Staged material digests do not match the state manifest.");
    }
  }
  if (
    state.materialManifest.length !== 0 &&
    hashMaterialSet(state.materialManifest) !== state.materialSetHash
  ) {
    throw storageCorrupt("Staged material-set hash does not match the state manifest.");
  }
  return { subject, materials, state };
};

const requireStagedFact = async <T>(promise: Promise<T>, label: string): Promise<T> => {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") {
      throw storageCorrupt(`Staging directory is missing ${label}.`, error);
    }
    throw error;
  }
};

const expectEntries = async (
  root: string,
  directory: string,
  expected: ReadonlyMap<string, "file" | "directory">,
): Promise<void> => {
  const entries = await listFactDirectory(root, directory);
  if (entries.length !== expected.size) {
    throw storageCorrupt("Staging directory has an incomplete or unknown entry set.");
  }
  for (const entry of entries) {
    if (expected.get(entry.name) !== entry.kind) {
      throw storageCorrupt("Staging directory has an incomplete or unknown entry set.");
    }
  }
};

/** Fixed-path, journal-addressable create-and-first-ingest staging seam. */
export class FileIngestStaging {
  private readonly layout: Layout;
  private readonly spaces: FileSpaceStore;

  /**
   * Creates a fixed-path staging seam with its space-fact dependency.
   *
   * @param layout - Confined local fact layout.
   * @param spaces - Store used to validate the candidate subject's space.
   */
  constructor(layout: Layout, spaces: FileSpaceStore) {
    this.layout = layout;
    this.spaces = spaces;
  }

  /**
   * Validates all input before creating the fixed staging directory, then writes facts safely.
   *
   * @param requestId - Journal request that owns the staging directory.
   * @param input - Complete subject, material, and state facts to stage.
   */
  async prepare(requestId: RequestId, input: IngestStagingInput): Promise<void> {
    const prepared = validateCompleteInput(input);
    await this.spaces.read(prepared.subject.spaceId);
    const subjectId = prepared.subject.id;
    const staging = this.layout.ingestStagingDirectory(requestId, subjectId);
    await createPrivateDirectoryExclusive(this.layout.root, staging);

    await createFactFile(
      this.layout.root,
      this.layout.stagedSubjectFile(requestId, subjectId),
      prepared.subject,
      storedSubjectSchema,
    );
    const stagedMaterialsDirectory = join(staging, "knowledge", "materials");
    await assertNoSymlinkPath(this.layout.root, stagedMaterialsDirectory);
    await ensurePrivateDirectory(stagedMaterialsDirectory);
    await assertNoSymlinkPath(this.layout.root, stagedMaterialsDirectory);
    for (const material of prepared.materials) {
      await atomicCreateDirectory(
        this.layout.root,
        this.layout.stagedMaterialDirectory(requestId, subjectId, material.record.id),
        async (directory) => {
          await createFactFile(
            this.layout.root,
            join(directory, "material.json"),
            material.record,
            storedMaterialSchema,
          );
          await atomicCreateFile(
            this.layout.root,
            join(directory, "content.txt"),
            material.content,
          );
        },
      );
    }
    await createFactFile(
      this.layout.root,
      this.layout.stagedStateFile(requestId, subjectId),
      prepared.state,
      storedStateSchema,
    );
    await syncDirectory(stagedMaterialsDirectory);
    await syncDirectory(dirname(stagedMaterialsDirectory));
    await syncDirectory(staging);
  }

  /**
   * Re-reads every staged fact, then publishes the complete subject directory without replacement.
   *
   * @param requestId - Journal request that owns the staging directory.
   * @param subjectId - Candidate subject to publish.
   */
  async publish(requestId: RequestId, subjectId: SubjectId): Promise<void> {
    await this.verify(requestId, subjectId);
    await publishDirectoryNoReplace(
      this.layout.root,
      this.layout.ingestStagingDirectory(requestId, subjectId),
      this.layout.subjectDirectory(subjectId),
    );
  }

  /**
   * Removes only the staging directory named by one journal request/subject pair.
   *
   * @param requestId - Journal request that owns the staging directory.
   * @param subjectId - Candidate subject whose staging should be removed.
   */
  async cleanup(requestId: RequestId, subjectId: SubjectId): Promise<void> {
    const staging = this.layout.ingestStagingDirectory(requestId, subjectId);
    const parent = dirname(staging);
    await assertNoSymlinkPath(this.layout.root, parent);
    let status;
    try {
      status = await lstat(staging);
    } catch (error) {
      if (isMissing(error)) return;
      throw error;
    }
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw storageCorrupt("Journal staging path is not a real directory.");
    }
    await rm(staging, { recursive: true, force: false });
    await syncDirectory(parent);
  }

  private async verify(requestId: RequestId, subjectId: SubjectId): Promise<void> {
    const staging = this.layout.ingestStagingDirectory(requestId, subjectId);
    await expectEntries(
      this.layout.root,
      staging,
      new Map([
        ["knowledge", "directory"],
        ["state.json", "file"],
        ["subject.json", "file"],
      ]),
    );
    const materialsDirectory = join(staging, "knowledge", "materials");
    await expectEntries(
      this.layout.root,
      join(staging, "knowledge"),
      new Map([["materials", "directory"]]),
    );

    const subject = await requireStagedFact(
      readFactFile(
        this.layout.root,
        this.layout.stagedSubjectFile(requestId, subjectId),
        storedSubjectSchema,
      ),
      "subject.json",
    );
    if (subject.id !== subjectId) {
      throw storageCorrupt("Staged subject id does not match its directory path.");
    }
    await this.spaces.read(subject.spaceId);

    const state = await requireStagedFact(
      readFactFile(
        this.layout.root,
        this.layout.stagedStateFile(requestId, subjectId),
        storedStateSchema,
      ),
      "state.json",
    );
    if (state.subjectId !== subjectId) {
      throw storageCorrupt("Staged state subject does not match its directory path.");
    }

    const materialEntries = await listFactDirectory(this.layout.root, materialsDirectory);
    if (materialEntries.length !== state.materialManifest.length) {
      throw storageCorrupt("Staged material directories do not match the state manifest.");
    }
    for (const entry of state.materialManifest) {
      const directoryEntry = materialEntries.find((item) => item.name === entry.materialId);
      if (directoryEntry?.kind !== "directory") {
        throw storageCorrupt("Staged material directories do not match the state manifest.");
      }
      const directory = this.layout.stagedMaterialDirectory(requestId, subjectId, entry.materialId);
      await expectEntries(
        this.layout.root,
        directory,
        new Map([
          ["content.txt", "file"],
          ["material.json", "file"],
        ]),
      );
      const record = await requireStagedFact(
        readFactFile(
          this.layout.root,
          this.layout.stagedMaterialFile(requestId, subjectId, entry.materialId),
          storedMaterialSchema,
        ),
        "material.json",
      );
      if (record.id !== entry.materialId || record.subjectId !== subjectId) {
        throw storageCorrupt("Staged material identity does not match its directory path.");
      }
      const content = decodeUtf8(
        await requireStagedFact(
          readRegularFile(
            this.layout.root,
            this.layout.stagedMaterialContentFile(requestId, subjectId, entry.materialId),
            WIRE_LIMITS.materialContentBytes,
          ),
          "content.txt",
        ),
        "Staged material content",
      );
      verifyMaterialIdentity(record, content);
      if (!manifestEntryMatches(record, entry)) {
        throw storageCorrupt("Staged material digests do not match the state manifest.");
      }
    }
    if (
      state.materialManifest.length !== 0 &&
      hashMaterialSet(state.materialManifest) !== state.materialSetHash
    ) {
      throw storageCorrupt("Staged material-set hash does not match the state manifest.");
    }
  }
}
