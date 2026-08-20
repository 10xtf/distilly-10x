import { DistillyError } from "@distilly/protocol";

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
