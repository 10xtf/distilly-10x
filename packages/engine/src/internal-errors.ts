import { DistillyError } from "@distilly/protocol";
import type { AmbiguousSubjectCandidates, SubjectSummary } from "@distilly/protocol";

/**
 * Builds a stable invalid-input error for an engine boundary.
 *
 * @param message - Safe explanation for the caller.
 * @param fieldPath - Optional input field that failed validation.
 * @returns A non-retryable invalid-input error.
 */
export const invalidInput = (message: string, fieldPath?: string): DistillyError =>
  new DistillyError({
    code: "invalid_input",
    message,
    retryable: false,
    ...(fieldPath === undefined ? {} : { fieldPath }),
  });

/**
 * Builds a stable missing-fact error.
 *
 * @param message - Safe explanation for the caller.
 * @returns A non-retryable missing-fact error.
 */
export const factNotFound = (message: string): DistillyError =>
  new DistillyError({ code: "not_found", message, retryable: false });

/**
 * Builds a stable corruption error without leaking local file contents.
 *
 * @param message - Safe explanation for the caller.
 * @param cause - Optional underlying failure retained as the error cause.
 * @returns A non-retryable storage-corruption error.
 */
export const storageCorrupt = (message: string, cause?: unknown): DistillyError =>
  new DistillyError(
    { code: "storage_corrupt", message, retryable: false },
    cause === undefined ? undefined : { cause },
  );

/**
 * Builds a stable unsupported-schema error.
 *
 * @param message - Safe explanation for the caller.
 * @param cause - Optional underlying failure retained as the error cause.
 * @returns A non-retryable unsupported-schema error with remediation.
 */
export const schemaUnsupported = (message: string, cause?: unknown): DistillyError =>
  new DistillyError(
    {
      code: "schema_unsupported",
      message,
      retryable: false,
      remediation: "Upgrade Distilly before reading or writing this fact format.",
    },
    cause === undefined ? undefined : { cause },
  );

/**
 * Builds a retryable lock-contention error.
 *
 * @param message - Safe explanation for the caller.
 * @returns A retryable busy error.
 */
export const lockBusy = (message: string): DistillyError =>
  new DistillyError({ code: "busy", message, retryable: true });

/**
 * Builds a stable conflict for a reused mutation request id.
 *
 * @param message - Safe explanation for the caller.
 * @returns A non-retryable idempotency conflict.
 */
export const idempotencyConflict = (message: string): DistillyError =>
  new DistillyError({
    code: "idempotency_conflict",
    message,
    retryable: false,
    remediation: "Generate a new requestId for a different mutation.",
  });

/**
 * Builds the typed single-candidate duplicate response used by create ingest.
 *
 * @param subject - Existing subject selected by the deterministic duplicate rule.
 * @param message - Safe explanation for the caller.
 * @returns A non-retryable typed already-exists error.
 */
export const subjectAlreadyExists = (
  subject: SubjectSummary,
  message = "A matching subject already exists.",
): DistillyError =>
  new DistillyError({
    code: "already_exists",
    message,
    retryable: false,
    remediation: "Use the existing subject or add a locator that proves a different identity.",
    subjectResolution: { kind: "found", subject },
  });

/**
 * Builds the typed multi-candidate response used by subject resolution.
 *
 * @param candidates - Stable list containing at least two possible subjects.
 * @param message - Safe explanation for the caller.
 * @returns A non-retryable typed ambiguous-subject error.
 */
export const ambiguousSubject = (
  candidates: AmbiguousSubjectCandidates,
  message = "More than one subject matches this identity.",
): DistillyError =>
  new DistillyError({
    code: "ambiguous_subject",
    message,
    retryable: false,
    remediation: "Choose an existing subject or add a unique identity locator.",
    subjectResolution: { kind: "ambiguous", candidates },
  });

/**
 * Builds a stable unavailable-projection error.
 *
 * @param message - Safe explanation for the caller.
 * @param cause - Optional underlying failure retained for local diagnostics.
 * @returns A retryable index-unavailable error.
 */
export const indexUnavailable = (message: string, cause?: unknown): DistillyError =>
  new DistillyError(
    {
      code: "index_unavailable",
      message,
      retryable: true,
      remediation: "Rebuild the local projection before reading it.",
    },
    cause === undefined ? undefined : { cause },
  );
