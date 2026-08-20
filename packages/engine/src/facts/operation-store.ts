import { DistillyError, operationRecordSchema } from "@distilly/protocol";
import type {
  CommitResult,
  OperationRecord,
  RequestId,
  RuntimeSchema,
  SubjectId,
} from "@distilly/protocol";

import { storageCorrupt } from "../internal-errors.js";
import { Layout } from "../layout.js";
import { createFactFile, readFactFile } from "./fact-file.js";
import type { FileSubjectStore } from "./subject-store.js";

const operationFactSchema: RuntimeSchema<OperationRecord> = {
  parse(value) {
    return operationRecordSchema.parse(value) as OperationRecord;
  },
};

const isFileCollision = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "EEXIST";

const requireSubject = async (subjects: FileSubjectStore, subjectId: SubjectId): Promise<void> => {
  try {
    await subjects.read(subjectId);
  } catch (error) {
    if (error instanceof DistillyError && error.code === "not_found") {
      throw storageCorrupt("Operation fact references a missing subject.", error);
    }
    throw error;
  }
};

const commitSubjectIds = (result: CommitResult): readonly SubjectId[] =>
  result.kind === "current"
    ? [result.version.subjectId, result.profile.subjectId]
    : [result.candidate.subjectId, result.review.subjectId];

const assertNever = (value: never): never => {
  throw storageCorrupt(`Unsupported operation method: ${String(value)}`);
};

const resultSubjectIds = (record: OperationRecord): readonly SubjectId[] => {
  switch (record.method) {
    case "subjects.create":
      return [record.result.id];
    case "subjects.archive":
    case "subjects.purge":
    case "distill.renew":
    case "distill.release":
    case "hosts.uninstall":
    case "library.rebuild":
    case "bundles.export":
      return [];
    case "materials.ingest":
    case "materials.ingestFiles":
      return [record.result.subject.id];
    case "distill.brief":
      return [record.result.subject.id, record.result.job.subjectId];
    case "distill.commit":
    case "profiles.correct":
      return commitSubjectIds(record.result);
    case "distill.redistill":
      return [record.result.subjectId];
    case "versions.promote":
    case "versions.reject":
    case "versions.rollback":
      return [record.result.subjectId];
    case "hosts.install":
    case "hosts.export":
      return [record.result.subjectId];
    case "bundles.import":
      return [
        record.result.subject.id,
        record.result.candidate.subjectId,
        record.result.review.subjectId,
      ];
    default:
      return assertNever(record);
  }
};

const assertSubject = (subjectId: SubjectId, record: OperationRecord): void => {
  if (resultSubjectIds(record).some((resultSubjectId) => resultSubjectId !== subjectId)) {
    throw storageCorrupt("Operation result subject does not match its fact path.");
  }
};

/** Concrete local store for immutable successful-operation facts. */
export class FileOperationStore {
  readonly #layout: Layout;
  readonly #subjects: FileSubjectStore;

  /**
   * Creates an operation store with its required subject-fact dependency.
   *
   * @param layout - Confined local fact layout.
   * @param subjects - Store used to validate operation ownership.
   */
  constructor(layout: Layout, subjects: FileSubjectStore) {
    this.#layout = layout;
    this.#subjects = subjects;
  }

  /**
   * Publishes one immutable operation or accepts an exact retry.
   *
   * @param subjectId - Subject path that owns the operation.
   * @param record - Complete successful-operation fact.
   * @returns Completion after publication or exact retry validation.
   */
  async write(subjectId: SubjectId, record: OperationRecord): Promise<void> {
    let parsed: OperationRecord;
    try {
      parsed = operationFactSchema.parse(record);
    } catch (error) {
      throw storageCorrupt(
        "Operation fact cannot be written because its schema is invalid.",
        error,
      );
    }
    await requireSubject(this.#subjects, subjectId);
    assertSubject(subjectId, parsed);
    const path = this.#layout.operationFile(subjectId, parsed.requestId);
    try {
      await createFactFile(this.#layout.root, path, parsed, operationFactSchema);
    } catch (error) {
      if (!isFileCollision(error)) throw error;
      const existing = await this.read(subjectId, parsed.requestId);
      if (existing.checksum === parsed.checksum) return;
      throw storageCorrupt("Immutable request id already contains a different operation.", error);
    }
  }

  /**
   * Reads an operation and validates its path id and subject association.
   *
   * @param subjectId - Subject path that owns the operation.
   * @param requestId - Request path segment.
   * @returns The verified immutable operation.
   */
  async read(subjectId: SubjectId, requestId: RequestId): Promise<OperationRecord> {
    await requireSubject(this.#subjects, subjectId);
    const record = await readFactFile(
      this.#layout.root,
      this.#layout.operationFile(subjectId, requestId),
      operationFactSchema,
    );
    if (record.requestId !== requestId) {
      throw storageCorrupt("Operation request id does not match its fact path.");
    }
    assertSubject(subjectId, record);
    return record;
  }
}
