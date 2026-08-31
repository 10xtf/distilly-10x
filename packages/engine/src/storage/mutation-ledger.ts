import type { DatabaseSync } from "node:sqlite";

import {
  DistillyError,
  actorContextSchema,
  engineMethodSchemas,
  eventRecordSchema,
  factChecksumSchema,
  isoDateTimeSchema,
  requestIdSchema,
  subjectIdSchema,
} from "@distilly/protocol";
import type {
  ActorContext,
  EngineEvent,
  EngineMethodMap,
  EventId,
  EventRecord,
  FactChecksum,
  IngestResult,
  IsoDateTime,
  RequestId,
  SubjectId,
  SubjectSummary,
} from "@distilly/protocol";

import { canonicalJson } from "../facts/canonical-json.js";
import { computeFactChecksum, sealFact, verifyFactChecksum } from "../facts/checksum.js";
import { idempotencyConflict, storageCorrupt } from "../internal-errors.js";

/** Mutation methods that share the first SQLite operation ledger. */
export type SqliteLedgerMethod = "subjects.create" | "materials.ingest";

type LedgerResult<M extends SqliteLedgerMethod> = EngineMethodMap[M]["result"];

/** Lookup key for a globally unique completed mutation. */
export interface MutationReplayInput<M extends SqliteLedgerMethod> {
  readonly requestId: RequestId;
  readonly method: M;
  readonly inputChecksum: FactChecksum;
  readonly actor: ActorContext;
}

/** Complete successful operation written in the same transaction as its business facts. */
export interface CompletedOperationInput<
  M extends SqliteLedgerMethod,
> extends MutationReplayInput<M> {
  readonly subjectId: SubjectId;
  readonly actor: ActorContext;
  readonly result: LedgerResult<M>;
  readonly completedAt: IsoDateTime;
}

/** Durable event fields written in the same transaction as their operation. */
export interface MutationEventInput {
  readonly eventId: EventId;
  readonly event: EngineEvent;
  readonly actor: ActorContext;
  readonly requestId: RequestId;
}

interface OperationRow {
  readonly method: unknown;
  readonly scope_subject_id: unknown;
  readonly actor_json: unknown;
  readonly input_checksum: unknown;
  readonly result_json: unknown;
  readonly completed_at: unknown;
  readonly existing_subject_id: unknown;
}

interface EventOperationRow {
  readonly scope_subject_id: unknown;
  readonly actor_json: unknown;
}

const parseJson = (value: string, label: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw storageCorrupt(`SQLite ${label} is not valid JSON.`, error);
  }
};

const storedText = (value: unknown, label: string): string => {
  if (typeof value !== "string") throw storageCorrupt(`SQLite ${label} is invalid.`);
  return value;
};

const parseStored = <T>(parse: () => T, label: string): T => {
  try {
    return parse();
  } catch (error) {
    if (error instanceof DistillyError && error.code === "storage_corrupt") throw error;
    throw storageCorrupt(`SQLite ${label} is invalid.`, error);
  }
};

const runInsert = (write: () => void, label: string): void => {
  try {
    write();
  } catch (error) {
    if (error instanceof DistillyError) throw error;
    throw storageCorrupt(`SQLite could not persist ${label}.`, error);
  }
};

const parseOperationResult = <M extends SqliteLedgerMethod>(
  method: M,
  resultJson: string,
): LedgerResult<M> => {
  const parsed = parseStored(
    () => engineMethodSchemas[method].result.parse(parseJson(resultJson, "operation result")),
    "operation result",
  );
  if (canonicalJson(parsed) !== resultJson) {
    throw storageCorrupt("SQLite operation result is not canonically encoded.");
  }
  return parsed;
};

const operationResultSubjectId = (
  method: SqliteLedgerMethod,
  result: SubjectSummary | IngestResult,
): SubjectId =>
  method === "subjects.create"
    ? (result as SubjectSummary).id
    : (result as IngestResult).subject.id;

/**
 * Hashes normalized mutation parameters together with their trusted actor.
 *
 * The RequestId is deliberately excluded so a retry compares the actual mutation identity.
 *
 * @param method - Mutation method discriminant included in the digest.
 * @param normalizedParams - Canonical transaction input for the method.
 * @param actor - Trusted actor bound to the client session.
 * @returns The full canonical mutation checksum.
 */
export const computeMutationInputChecksum = (
  method: SqliteLedgerMethod,
  normalizedParams: unknown,
  actor: ActorContext,
): FactChecksum => computeFactChecksum({ method, params: normalizedParams, actor });

/**
 * Replays one exact completed mutation or rejects any global RequestId reuse.
 *
 * Result JSON is parsed with the Protocol schema for the stored method before it leaves storage.
 *
 * @param database - Database connection inside the caller's active transaction.
 * @param input - Expected global RequestId, method, and normalized input checksum.
 * @returns The strictly parsed stored result, or undefined when the RequestId is unused.
 */
export const replayCompletedMutation = <M extends SqliteLedgerMethod>(
  database: DatabaseSync,
  input: MutationReplayInput<M>,
): LedgerResult<M> | undefined => {
  const requestId = parseStored(() => requestIdSchema.parse(input.requestId), "request id");
  const expectedChecksum = parseStored(
    () => factChecksumSchema.parse(input.inputChecksum),
    "input checksum",
  );
  const expectedActor = parseStored(
    () => actorContextSchema.parse(input.actor),
    "expected operation actor",
  );
  let row: OperationRow | undefined;
  try {
    row = database
      .prepare(
        `SELECT operations.method, operations.scope_subject_id, operations.actor_json,
                operations.input_checksum, operations.result_json, operations.completed_at,
                subjects.id AS existing_subject_id
         FROM operations
         LEFT JOIN subjects ON subjects.id = operations.scope_subject_id
         WHERE operations.request_id = ?`,
      )
      .get(requestId) as OperationRow | undefined;
  } catch (error) {
    throw storageCorrupt("SQLite could not read the mutation ledger.", error);
  }
  if (row === undefined) return undefined;

  const storedMethod = storedText(row.method, "operation method");
  if (storedMethod !== "subjects.create" && storedMethod !== "materials.ingest") {
    throw storageCorrupt("SQLite operation method is unsupported by its storage schema.");
  }
  const scopeSubjectId = parseStored(
    () => subjectIdSchema.parse(storedText(row.scope_subject_id, "operation subject scope")),
    "operation subject scope",
  );
  const existingSubjectId = parseStored(
    () =>
      subjectIdSchema.parse(
        storedText(row.existing_subject_id, "operation existing subject scope"),
      ),
    "operation existing subject scope",
  );
  if (existingSubjectId !== scopeSubjectId) {
    throw storageCorrupt("SQLite operation scope does not resolve to its subject authority row.");
  }
  const actorJson = storedText(row.actor_json, "operation actor");
  const actor = parseStored(
    () => actorContextSchema.parse(parseJson(actorJson, "operation actor")),
    "operation actor",
  );
  if (canonicalJson(actor) !== actorJson) {
    throw storageCorrupt("SQLite operation actor is not canonically encoded.");
  }
  const storedChecksum = parseStored(
    () => factChecksumSchema.parse(storedText(row.input_checksum, "operation input checksum")),
    "operation input checksum",
  );
  parseStored(
    () => isoDateTimeSchema.parse(storedText(row.completed_at, "operation completion time")),
    "operation completion time",
  );

  if (storedMethod !== input.method || storedChecksum !== expectedChecksum) {
    throw idempotencyConflict("RequestId was already used by a different mutation input.");
  }
  if (canonicalJson(actor) !== canonicalJson(expectedActor)) {
    throw storageCorrupt("SQLite operation actor disagrees with its trusted mutation identity.");
  }

  const result = parseOperationResult(
    input.method,
    storedText(row.result_json, "operation result"),
  );
  if (operationResultSubjectId(input.method, result) !== scopeSubjectId) {
    throw storageCorrupt("SQLite operation result disagrees with its subject scope.");
  }
  return result;
};

/**
 * Inserts one successful operation into the global RequestId ledger.
 *
 * @param database - Database connection inside the caller's active write transaction.
 * @param input - Validated operation identity, actor, result, scope, and completion time.
 */
export const insertCompletedOperationInTransaction = <M extends SqliteLedgerMethod>(
  database: DatabaseSync,
  input: CompletedOperationInput<M>,
): void => {
  const requestId = parseStored(() => requestIdSchema.parse(input.requestId), "request id");
  const subjectId = parseStored(
    () => subjectIdSchema.parse(input.subjectId),
    "operation subject id",
  );
  const actor = parseStored(() => actorContextSchema.parse(input.actor), "operation actor");
  const inputChecksum = parseStored(
    () => factChecksumSchema.parse(input.inputChecksum),
    "operation input checksum",
  );
  const completedAt = parseStored(
    () => isoDateTimeSchema.parse(input.completedAt),
    "operation completion time",
  );
  const result = parseStored(
    () => engineMethodSchemas[input.method].result.parse(input.result),
    "operation result",
  ) as LedgerResult<M>;
  if (operationResultSubjectId(input.method, result) !== subjectId) {
    throw storageCorrupt("A completed operation result disagrees with its subject scope.");
  }

  runInsert(() => {
    database
      .prepare(
        `INSERT INTO operations(
           request_id, method, scope_subject_id, actor_json,
           input_checksum, result_json, completed_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        requestId,
        input.method,
        subjectId,
        canonicalJson(actor),
        inputChecksum,
        canonicalJson(result),
        completedAt,
      );
  }, "a completed operation");
};

/**
 * Inserts one checksummed event record into the caller's active transaction.
 *
 * @param database - Database connection inside the caller's active write transaction.
 * @param input - Request-correlated event fields to seal and persist.
 * @returns The exact sealed event record written to SQLite.
 */
export const insertEventInTransaction = (
  database: DatabaseSync,
  input: MutationEventInput,
): EventRecord => {
  const record = parseStored(
    () =>
      eventRecordSchema.parse(
        sealFact<EventRecord>({
          schemaVersion: 1,
          eventId: input.eventId,
          event: input.event,
          actor: input.actor,
          requestId: input.requestId,
        }),
      ) as EventRecord,
    "event record",
  );
  verifyFactChecksum(record);
  if (record.event.subjectId === undefined) {
    throw storageCorrupt("A mutation event is missing its subject scope.");
  }
  if (record.requestId === undefined) {
    throw storageCorrupt("A mutation event is missing its request scope.");
  }
  const requestId = record.requestId;
  const subjectId = record.event.subjectId;
  let operation: EventOperationRow | undefined;
  try {
    operation = database
      .prepare(
        `SELECT scope_subject_id, actor_json
         FROM operations
         WHERE request_id = ?`,
      )
      .get(requestId) as EventOperationRow | undefined;
  } catch (error) {
    throw storageCorrupt("SQLite could not read the event's mutation operation.", error);
  }
  if (operation === undefined) {
    throw storageCorrupt("A mutation event is missing its completed operation.");
  }
  const operationSubjectId = parseStored(
    () =>
      subjectIdSchema.parse(
        storedText(operation.scope_subject_id, "event operation subject scope"),
      ),
    "event operation subject scope",
  );
  if (operationSubjectId !== subjectId) {
    throw storageCorrupt("A mutation event disagrees with its operation subject scope.");
  }
  const operationActorJson = storedText(operation.actor_json, "event operation actor");
  const operationActor = parseStored(
    () => actorContextSchema.parse(parseJson(operationActorJson, "event operation actor")),
    "event operation actor",
  );
  if (canonicalJson(operationActor) !== operationActorJson) {
    throw storageCorrupt("SQLite event operation actor is not canonically encoded.");
  }
  if (canonicalJson(operationActor) !== canonicalJson(record.actor)) {
    throw storageCorrupt("A mutation event disagrees with its operation actor.");
  }

  runInsert(() => {
    database
      .prepare(
        `INSERT INTO events(
           event_id, request_id, subject_id, actor_json, event_json, occurred_at
         ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        record.eventId,
        requestId,
        subjectId,
        canonicalJson(record.actor),
        canonicalJson(record),
        record.event.at,
      );
  }, "an event record");
  return record;
};
