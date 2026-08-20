import { isAbsolute, relative, resolve, sep } from "node:path";

import {
  eventIdSchema,
  materialIdSchema,
  requestIdSchema,
  spaceIdSchema,
  subjectIdSchema,
} from "@distilly/protocol";
import type { EventId, MaterialId, RequestId, SpaceId, SubjectId } from "@distilly/protocol";

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
   * Path of one successful mutation record.
   *
   * @param subjectId - Subject that owns the operation.
   * @param requestId - Idempotency key used as the file name.
   * @returns The confined absolute operation-record path.
   */
  operationFile(subjectId: SubjectId, requestId: RequestId): string {
    return this.inside(
      "subjects",
      subjectIdSchema.parse(subjectId),
      "operations",
      `${requestIdSchema.parse(requestId)}.json`,
    );
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
