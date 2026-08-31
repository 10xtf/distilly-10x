import { access, readFile, rm } from "node:fs/promises";
import { join } from "node:path";

import {
  DistillyError,
  eventIdSchema,
  isoDateTimeSchema,
  jobIdSchema,
  leaseIdSchema,
  leaseOwnerIdSchema,
  operationFactSchema,
  requestIdSchema,
  reviewDecisionTransactionRecordSchema,
  rollbackTransactionRecordSchema,
  subjectIdSchema,
  type ActorContext,
  type EventId,
  type EventRecord,
  type IsoDateTime,
  type JobId,
  type LeaseId,
  type LeaseOwnerId,
  type MaterialRecord,
  type OperationFact,
  type OperationRecord,
  type PendingJobMarker,
  type Profile,
  type RequestId,
  type ReviewDecisionTransactionRecord,
  type RollbackTransactionRecord,
  type RuntimeSchema,
  type SpaceId,
  type SubjectId,
  type SubjectStateRecord,
  type VersionId,
  type VersionClaimsSnapshot,
  type VersionMaterialEntry,
  type VersionRecord,
} from "@distilly/protocol";
import { afterEach, describe, expect, it } from "vitest";

import { InProcessEventBus } from "../defaults/in-process-event-bus.js";
import type { Clock } from "../defaults/system-clock.js";
import { FileCurrentProfileProjection } from "../facts/current-profile-projection.js";
import { computeFactChecksum, sealFact } from "../facts/checksum.js";
import {
  deriveMaterialId,
  digestBriefContract,
  digestContent,
  digestMaterialProvenance,
  hashMaterialSet,
} from "../facts/digests.js";
import { FileEventStore } from "../facts/event-store.js";
import { replaceFactFile } from "../facts/fact-file.js";
import { FileOperationStore } from "../facts/operation-store.js";
import { FileStateStore } from "../facts/state-store.js";
import { FileTransactionStore } from "../testing/legacy-file-transaction-store.test.fixture.js";
import {
  createVersionFixtureHarness,
  makeVersionArtifacts,
  publishVersionArtifacts,
  TEST_AT as VERSION_AT,
  TEST_SUBJECT_ID,
  type VersionFixtureHarness,
} from "../facts/version-fixture.test-support.js";
import { FileVersionStore, type VersionArtifactSet } from "../facts/version-store.js";
import { Layout } from "../layout.js";
import type { IdGenerator } from "../ports/id-generator.js";
import { renderProfile, renderPrompt } from "../profile/render.js";
import { deriveVersionId } from "../profile/version-id.js";
import { SqliteQueueRepository } from "../testing/legacy-sqlite-queue-projection.test.fixture.js";
import { FileRequestLock } from "../transaction/request-lock.js";
import {
  RecoveryService,
  type RecoveryHooks,
  type SubjectProjection,
} from "../testing/legacy-file-recovery.test.fixture.js";
import { FileSubjectLock } from "../transaction/subject-lock.js";
import {
  FileVersionStaging,
  legacyVersionStagingDirectory,
  type VersionStagingHooks,
} from "../testing/legacy-file-version-staging.test.fixture.js";
import {
  ReviewService,
  type ReviewServiceHooks,
} from "../testing/legacy-file-review-service.test.fixture.js";

const AT = isoDateTimeSchema.parse("2026-08-21T08:00:00.000Z");
const LATER = isoDateTimeSchema.parse("2026-08-21T09:00:00.000Z");
const ACTOR: ActorContext = { kind: "user", id: "step10-review-test" };
const roots: string[] = [];

const operationFactRuntimeSchema: RuntimeSchema<OperationFact> = {
  parse(value) {
    return operationFactSchema.parse(value) as OperationFact;
  },
};

const reviewTransactionRuntimeSchema: RuntimeSchema<ReviewDecisionTransactionRecord> = {
  parse(value) {
    return reviewDecisionTransactionRecordSchema.parse(value) as ReviewDecisionTransactionRecord;
  },
};

const rollbackTransactionRuntimeSchema: RuntimeSchema<RollbackTransactionRecord> = {
  parse(value) {
    return rollbackTransactionRecordSchema.parse(value) as RollbackTransactionRecord;
  },
};

class FakeClock implements Clock {
  current = AT;

  now(): IsoDateTime {
    return this.current;
  }
}

class SequenceIds implements IdGenerator {
  private subject = 10;
  private space = 10;
  private job = 10;
  private lease = 10;
  private owner = 10;
  private event = 10;

  subjectId(): SubjectId {
    return subjectIdSchema.parse(`subject_${(this.subject++).toString(16).padStart(32, "0")}`);
  }

  spaceId(): SpaceId {
    return `space_${(this.space++).toString(16).padStart(32, "0")}` as SpaceId;
  }

  jobId(): JobId {
    return jobIdSchema.parse(`job_${(this.job++).toString(16).padStart(32, "0")}`);
  }

  leaseId(): LeaseId {
    return leaseIdSchema.parse(`lease_${(this.lease++).toString(16).padStart(32, "0")}`);
  }

  leaseOwnerId(): LeaseOwnerId {
    return leaseOwnerIdSchema.parse(`lease_owner_${(this.owner++).toString(16).padStart(32, "0")}`);
  }

  eventId(): EventId {
    return eventIdSchema.parse(`event_${(this.event++).toString(16).padStart(32, "0")}`);
  }
}

const request = (digit: number): RequestId =>
  requestIdSchema.parse(`req_${digit.toString(16).padStart(32, "0")}`);

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

const failOnce = (): (() => void) => {
  let failed = false;
  return () => {
    if (failed) return;
    failed = true;
    throw new Error("simulated process crash");
  };
};

const expectCode = async (promise: Promise<unknown>, code: string): Promise<void> => {
  try {
    await promise;
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(DistillyError);
    expect(error).toMatchObject({ code });
  }
};

const materialEntry = (record: MaterialRecord): VersionMaterialEntry => ({
  materialId: record.id,
  contentDigest: record.contentDigest,
  provenanceDigest: record.provenanceDigest,
});

const makeExtraMaterial = (subjectId: SubjectId): { record: MaterialRecord; content: string } => {
  const content = "Ada later publishes a systems recovery guide.\n";
  const contentDigest = digestContent(content);
  const provisional = sealFact<MaterialRecord>({
    schemaVersion: 1,
    id: `mat_${"f".repeat(64)}` as MaterialRecord["id"],
    subjectId,
    kind: "web",
    contentDigest,
    provenanceDigest: `provenance_sha256_${"f".repeat(64)}` as MaterialRecord["provenanceDigest"],
    sourceIdentity: "source-uri-v1\0https://example.com/ada/recovery",
    source: {
      uri: "https://example.com/ada/recovery",
      medium: "article",
      access: "public",
      role: "first_party_expression",
      capturedAt: AT,
      authors: ["Ada"],
    },
    derivation: { kind: "native_text" },
    participants: [],
    sensitivity: "private",
    flags: [],
    storedAt: AT,
  });
  const provenanceDigest = digestMaterialProvenance(provisional);
  return {
    content,
    record: sealFact<MaterialRecord>({
      ...provisional,
      provenanceDigest,
      id: deriveMaterialId(provisional.sourceIdentity, provenanceDigest, contentDigest),
    }),
  };
};

const eventRecord = (
  eventId: number,
  kind: "version.current" | "version.suspended",
  versionId: VersionId,
): EventRecord =>
  sealFact<EventRecord>({
    schemaVersion: 1,
    eventId: eventIdSchema.parse(`event_${eventId.toString(16).padStart(32, "0")}`),
    event: { kind, subjectId: TEST_SUBJECT_ID, versionId, at: VERSION_AT },
    actor: { kind: "system", id: "version-fixture" },
  });

const activeLease = (): PendingJobMarker["lease"] => {
  const fields = {
    sourceGroupingVersion: "source-groups-v1",
    promptVersion: `host-distill-v1-sha256_${"a".repeat(64)}`,
    draftSchemaVersion: 1,
  } as const;
  return {
    id: leaseIdSchema.parse(`lease_${"e".repeat(32)}`),
    owner: leaseOwnerIdSchema.parse(`lease_owner_${"e".repeat(32)}`),
    acquiredAt: AT,
    expiresAt: LATER,
    contract: { ...fields, digest: digestBriefContract(fields) },
  };
};

interface ReviewHarness {
  readonly fixture: VersionFixtureHarness;
  readonly layout: Layout;
  readonly clock: FakeClock;
  readonly ids: SequenceIds;
  readonly states: FileStateStore;
  readonly versions: FileVersionStore;
  readonly events: FileEventStore;
  readonly operations: FileOperationStore;
  readonly transactions: FileTransactionStore;
  readonly queue: SqliteQueueRepository;
  readonly currentProfiles: FileCurrentProfileProjection;
  readonly recovery: RecoveryService;
  readonly service: ReviewService;
}

const openHarness = (input: {
  readonly fixture: VersionFixtureHarness;
  readonly clock: FakeClock;
  readonly ids: SequenceIds;
  readonly serviceHooks?: ReviewServiceHooks;
  readonly recoveryHooks?: RecoveryHooks;
  readonly stagingHooks?: VersionStagingHooks;
  readonly library?: SubjectProjection;
}): ReviewHarness => {
  const { fixture, clock, ids } = input;
  const layout = fixture.layout;
  const states = new FileStateStore(layout, fixture.subjects, fixture.materials);
  const versions = new FileVersionStore(layout, fixture.materials);
  const versionStaging = new FileVersionStaging(layout, versions, input.stagingHooks);
  const currentProfiles = new FileCurrentProfileProjection(layout, versions);
  const events = new FileEventStore(layout, fixture.subjects);
  const operations = new FileOperationStore(layout, fixture.subjects);
  const transactions = new FileTransactionStore(layout);
  const requestLocks = new FileRequestLock(layout, clock);
  const subjectLocks = new FileSubjectLock(layout, clock);
  const queue = new SqliteQueueRepository({
    root: layout.root,
    indexDirectory: layout.indexDirectory(),
    databaseFile: join(layout.indexDirectory(), "queue.db"),
    dirtyFile: join(layout.indexDirectory(), "queue.dirty"),
  });
  const eventBus = new InProcessEventBus();
  const recovery = new RecoveryService({
    transactions,
    operations,
    subjects: fixture.subjects,
    states,
    events,
    versions,
    versionStaging,
    currentProfiles,
    requestLocks,
    subjectLocks,
    queue,
    ...(input.library === undefined ? {} : { library: input.library }),
    eventBus,
    clock,
    ...(input.recoveryHooks === undefined ? {} : { hooks: input.recoveryHooks }),
  });
  const service = new ReviewService({
    subjects: fixture.subjects,
    states,
    materials: fixture.materials,
    versions,
    versionStaging,
    operations,
    transactions,
    events,
    requestLocks,
    subjectLocks,
    recovery,
    ids,
    clock,
    eventBus,
    ...(input.serviceHooks === undefined ? {} : { hooks: input.serviceHooks }),
  });
  return {
    fixture,
    layout,
    clock,
    ids,
    states,
    versions,
    events,
    operations,
    transactions,
    queue,
    currentProfiles,
    recovery,
    service,
  };
};

const pendingFor = (
  manifest: readonly VersionMaterialEntry[],
  baseVersionId: VersionId,
  lease?: PendingJobMarker["lease"],
): PendingJobMarker => ({
  jobId: jobIdSchema.parse(`job_${"d".repeat(32)}`),
  generation: 2,
  baseVersionId,
  materialSetHash: hashMaterialSet(manifest),
  addedMaterialCount: 1,
  totalMaterialCount: manifest.length,
  queuedAt: AT,
  ...(lease === undefined ? {} : { lease }),
});

const seedState = async (harness: ReviewHarness, state: SubjectStateRecord): Promise<void> => {
  await harness.states.write(state);
  await harness.queue.rebuild(async function* () {
    yield await Promise.resolve({
      subjectId: state.subjectId,
      stateChecksum: state.checksum,
      ...(state.pending === undefined ? {} : { pending: state.pending }),
    });
  }, harness.clock.now());
};

const setupCandidate = async (
  options: {
    readonly pending?: "none" | "delta";
    readonly serviceHooks?: ReviewServiceHooks;
    readonly recoveryHooks?: RecoveryHooks;
    readonly stagingHooks?: VersionStagingHooks;
    readonly library?: SubjectProjection;
  } = {},
) => {
  const fixture = await createVersionFixtureHarness();
  roots.push(fixture.root);
  const current = makeVersionArtifacts(fixture);
  const candidate = makeVersionArtifacts(fixture, {
    parentId: current.version.id,
    disposition: "suspended",
    claimTextSuffix: " Candidate.",
  });
  await publishVersionArtifacts(fixture, current, request(101));
  await publishVersionArtifacts(fixture, candidate, request(102));
  const clock = new FakeClock();
  const ids = new SequenceIds();
  const harness = openHarness({ fixture, clock, ids, ...options });
  let manifest = [...current.manifest.items];
  if (options.pending === "delta") {
    const extra = makeExtraMaterial(TEST_SUBJECT_ID);
    await fixture.materials.write(extra.record, extra.content);
    manifest = [...manifest, materialEntry(extra.record)].sort((left, right) =>
      left.materialId < right.materialId ? -1 : left.materialId > right.materialId ? 1 : 0,
    );
  }
  const pending =
    options.pending === "delta" ? pendingFor(manifest, current.version.id) : undefined;
  const state = sealFact<SubjectStateRecord>({
    schemaVersion: 2,
    subjectId: TEST_SUBJECT_ID,
    generation: options.pending === "delta" ? 2 : 1,
    materialSetHash: hashMaterialSet(manifest),
    materialManifest: manifest,
    currentVersionId: current.version.id,
    suspendedVersionId: candidate.version.id,
    ...(pending === undefined ? {} : { pending }),
  });
  await seedState(harness, state);
  await harness.currentProfiles.apply(request(103), current);
  await harness.events.write(
    TEST_SUBJECT_ID,
    eventRecord(1, "version.current", current.version.id),
  );
  await harness.events.write(
    TEST_SUBJECT_ID,
    eventRecord(2, "version.suspended", candidate.version.id),
  );
  return { harness, current, candidate, state };
};

const setupRollback = async (
  options: {
    readonly pending?: "none" | "delta" | "leased";
    readonly serviceHooks?: ReviewServiceHooks;
    readonly recoveryHooks?: RecoveryHooks;
    readonly stagingHooks?: VersionStagingHooks;
    readonly library?: SubjectProjection;
  } = {},
) => {
  const fixture = await createVersionFixtureHarness();
  roots.push(fixture.root);
  const source = makeVersionArtifacts(fixture);
  const current = makeVersionArtifacts(fixture, {
    parentId: source.version.id,
    claimTextSuffix: " Current.",
  });
  await publishVersionArtifacts(fixture, source, request(111));
  await publishVersionArtifacts(fixture, current, request(112));
  const clock = new FakeClock();
  const ids = new SequenceIds();
  const harness = openHarness({ fixture, clock, ids, ...options });
  let manifest = [...current.manifest.items];
  if (options.pending === "delta" || options.pending === "leased") {
    const extra = makeExtraMaterial(TEST_SUBJECT_ID);
    await fixture.materials.write(extra.record, extra.content);
    manifest = [...manifest, materialEntry(extra.record)].sort((left, right) =>
      left.materialId < right.materialId ? -1 : left.materialId > right.materialId ? 1 : 0,
    );
  }
  const pending =
    options.pending === "delta" || options.pending === "leased"
      ? pendingFor(
          manifest,
          current.version.id,
          options.pending === "leased" ? activeLease() : undefined,
        )
      : undefined;
  const state = sealFact<SubjectStateRecord>({
    schemaVersion: 2,
    subjectId: TEST_SUBJECT_ID,
    generation: pending === undefined ? 1 : 2,
    materialSetHash: hashMaterialSet(manifest),
    materialManifest: manifest,
    currentVersionId: current.version.id,
    ...(pending === undefined ? {} : { pending }),
  });
  await seedState(harness, state);
  await harness.currentProfiles.apply(request(113), current);
  await harness.events.write(TEST_SUBJECT_ID, eventRecord(3, "version.current", source.version.id));
  await harness.events.write(
    TEST_SUBJECT_ID,
    eventRecord(4, "version.current", current.version.id),
  );
  return { harness, source, current, state };
};

const factSnapshot = async (harness: ReviewHarness) => ({
  state: await readFile(harness.layout.stateFile(TEST_SUBJECT_ID), "utf8"),
  events: await harness.events.list(TEST_SUBJECT_ID),
  versions: (await harness.versions.list(TEST_SUBJECT_ID)).map((version) => version.version.id),
  operations: await harness.operations.list(),
  transactions: await harness.transactions.list(),
  queue: await harness.queue.list({ subjectId: TEST_SUBJECT_ID }, harness.clock.now()),
});

const forgeRollbackSource = (
  transaction: RollbackTransactionRecord,
  source: VersionArtifactSet,
): RollbackTransactionRecord => {
  const creation = { kind: "rollback", targetVersionId: source.version.id } as const;
  const versionId = deriveVersionId(
    {
      subjectId: transaction.subjectId,
      subjectDisplayName: source.version.subjectDisplayName,
      parentId: transaction.previousCurrentVersionId,
      generation: source.version.generation,
      materialSetHash: source.version.materialSetHash,
      creation,
      actor: transaction.version.actor,
      createdDisposition: "current",
      rendererVersion: source.version.rendererVersion,
      quality: source.version.quality,
    },
    source.claims.claims,
  );
  const version = sealFact<VersionRecord>({
    schemaVersion: 1,
    id: versionId,
    subjectId: transaction.subjectId,
    subjectDisplayName: source.version.subjectDisplayName,
    parentId: transaction.previousCurrentVersionId,
    generation: source.version.generation,
    materialSetHash: source.version.materialSetHash,
    materialCount: source.version.materialCount,
    creation,
    createdDisposition: "current",
    actor: transaction.version.actor,
    quality: source.version.quality,
    rendererVersion: source.version.rendererVersion,
    createdAt: transaction.preparedAt,
  });
  const claims = sealFact<VersionClaimsSnapshot>({
    schemaVersion: 1,
    subjectId: transaction.subjectId,
    versionId,
    claims: source.claims.claims,
  });
  const rendered = renderProfile({
    subjectId: transaction.subjectId,
    displayName: source.version.subjectDisplayName,
    versionId,
    claims: source.claims.claims,
    quality: source.version.quality,
  });
  const profile: Profile = {
    subjectId: transaction.subjectId,
    displayName: source.version.subjectDisplayName,
    versionId,
    claims: source.claims.claims,
    core: rendered.core,
    domains: rendered.domains,
    rendered: rendered.markdown,
    quality: source.version.quality,
  };
  const { checksum: _stateChecksum, ...statePayload } = transaction.targetState;
  void _stateChecksum;
  const targetState = sealFact<SubjectStateRecord>({
    ...statePayload,
    currentVersionId: versionId,
  });
  const reason = transaction.events[0].reason;
  if (reason === undefined) throw new Error("Expected a rollback reason.");
  const { checksum: _operationChecksum, ...operationPayload } = transaction.operation;
  void _operationChecksum;
  const operation = sealFact<OperationRecord<"versions.rollback">>({
    ...operationPayload,
    inputChecksum: computeFactChecksum({
      method: "versions.rollback",
      params: { subjectId: transaction.subjectId, targetVersionId: source.version.id, reason },
      actor: operationPayload.actor,
    }),
    result: {
      id: versionId,
      subjectId: transaction.subjectId,
      parentId: transaction.previousCurrentVersionId,
      generation: version.generation,
      materialSetHash: version.materialSetHash,
      creation,
      status: "current",
      actor: version.actor,
      quality: version.quality,
      createdAt: version.createdAt,
    },
  });
  const { checksum: _eventChecksum, ...eventPayload } = transaction.events[0];
  void _eventChecksum;
  const event = sealFact<EventRecord>({
    ...eventPayload,
    event: { ...eventPayload.event, versionId },
    relatedVersionId: source.version.id,
  });
  const { checksum: _journalChecksum, ...journalPayload } = transaction;
  void _journalChecksum;
  const forgedPayload = {
    ...journalPayload,
    targetVersionId: source.version.id,
    targetState,
    version,
    materialManifest: source.manifest,
    claims,
    profile,
    prompt: renderPrompt(profile),
    operation,
    events: [event],
  } as const;
  return rollbackTransactionRecordSchema.parse({
    ...forgedPayload,
    checksum: computeFactChecksum(forgedPayload),
  }) as RollbackTransactionRecord;
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("ReviewService", { timeout: 60_000 }, () => {
  it("promotes the exact active candidate and rebases pending work to a fresh unleased job", async () => {
    const { harness, candidate, state } = await setupCandidate({ pending: "delta" });
    const result = await harness.service.promote(
      {
        subjectId: TEST_SUBJECT_ID,
        candidateVersionId: candidate.version.id,
        reason: "Evidence reviewed.",
      },
      ACTOR,
      { requestId: request(1) },
    );

    expect(result).toMatchObject({ id: candidate.version.id, status: "current" });
    const current = await harness.states.read(TEST_SUBJECT_ID);
    expect(current.currentVersionId).toBe(candidate.version.id);
    expect(current.suspendedVersionId).toBeUndefined();
    expect(current.pending).toMatchObject({
      generation: state.generation,
      baseVersionId: candidate.version.id,
      addedMaterialCount: 1,
      totalMaterialCount: 2,
      queuedAt: AT,
    });
    expect(current.pending?.jobId).not.toBe(state.pending?.jobId);
    expect(current.pending?.lease).toBeUndefined();
    await expect(harness.currentProfiles.readExact(candidate)).resolves.toBeUndefined();
    const journal = await harness.transactions.read(request(1));
    expect(journal).toMatchObject({
      transactionKind: "review_decision",
      method: "promote",
      state: "committed",
      events: [
        { event: { kind: "version.promoted" }, reason: "Evidence reviewed." },
        { event: { kind: "job.changed" } },
      ],
    });
    await expect(
      harness.service.promote(
        {
          subjectId: TEST_SUBJECT_ID,
          candidateVersionId: candidate.version.id,
          reason: "Evidence reviewed.",
        },
        ACTOR,
        { requestId: request(1) },
      ),
    ).resolves.toEqual(result);
  });

  it("rejects without changing current projection or any pending marker byte", async () => {
    const { harness, current, candidate, state } = await setupCandidate({ pending: "delta" });
    const result = await harness.service.reject(
      {
        subjectId: TEST_SUBJECT_ID,
        candidateVersionId: candidate.version.id,
        reason: "Insufficient support.",
      },
      ACTOR,
      { requestId: request(2) },
    );

    expect(result).toMatchObject({ id: candidate.version.id, status: "rejected" });
    const after = await harness.states.read(TEST_SUBJECT_ID);
    expect(after.currentVersionId).toBe(current.version.id);
    expect(after.suspendedVersionId).toBeUndefined();
    expect(after.pending).toEqual(state.pending);
    await expect(harness.currentProfiles.readExact(current)).resolves.toBeUndefined();
    const journal = await harness.transactions.read(request(2));
    expect(journal).toMatchObject({
      transactionKind: "review_decision",
      method: "reject",
      state: "committed",
      events: [{ event: { kind: "version.rejected" }, reason: "Insufficient support." }],
    });
    if (journal.transactionKind !== "review_decision") throw new Error("Expected review journal.");
    expect(journal.events).toHaveLength(1);
  });

  it("keeps RequestId idempotency global across changed input, actor, and review method", async () => {
    const { harness, candidate, current } = await setupCandidate();
    const requestId = request(22);
    const input = {
      subjectId: TEST_SUBJECT_ID,
      candidateVersionId: candidate.version.id,
      reason: "Original decision.",
    };
    await harness.service.promote(input, ACTOR, { requestId });

    await expectCode(
      harness.service.promote({ ...input, reason: "Changed decision." }, ACTOR, { requestId }),
      "idempotency_conflict",
    );
    await expectCode(
      harness.service.promote(input, { kind: "sdk", id: "different-actor" }, { requestId }),
      "idempotency_conflict",
    );
    await expectCode(harness.service.reject(input, ACTOR, { requestId }), "idempotency_conflict");
    await expectCode(
      harness.service.rollback(
        {
          subjectId: TEST_SUBJECT_ID,
          targetVersionId: current.version.id,
          reason: "Different method.",
        },
        ACTOR,
        { requestId },
      ),
      "idempotency_conflict",
    );
  });

  it("rejects an orphan physical material before writing a review transaction", async () => {
    const { harness, candidate, state } = await setupCandidate();
    const orphan = makeExtraMaterial(TEST_SUBJECT_ID);
    await harness.fixture.materials.write(orphan.record, orphan.content);
    const requestId = request(23);

    await expectCode(
      harness.service.promote(
        { subjectId: TEST_SUBJECT_ID, candidateVersionId: candidate.version.id },
        ACTOR,
        { requestId },
      ),
      "storage_corrupt",
    );
    expect(await harness.states.read(TEST_SUBJECT_ID)).toEqual(state);
    await expectCode(harness.transactions.read(requestId), "not_found");
    await expectCode(harness.operations.read(requestId), "not_found");
    expect(await harness.events.list(TEST_SUBJECT_ID)).toHaveLength(2);
  });

  it("clears a zero-delta pending marker instead of retaining a meaningless job", async () => {
    const { harness, candidate, state } = await setupCandidate();
    if (state.currentVersionId === undefined) throw new Error("Expected a current version.");
    const zeroPending: PendingJobMarker = {
      jobId: jobIdSchema.parse(`job_${"c".repeat(32)}`),
      generation: state.generation,
      baseVersionId: state.currentVersionId,
      materialSetHash: state.materialSetHash!,
      addedMaterialCount: 0,
      totalMaterialCount: state.materialManifest.length,
      queuedAt: AT,
    };
    await seedState(harness, sealFact<SubjectStateRecord>({ ...state, pending: zeroPending }));

    await harness.service.promote(
      { subjectId: TEST_SUBJECT_ID, candidateVersionId: candidate.version.id },
      ACTOR,
      { requestId: request(3) },
    );
    expect((await harness.states.read(TEST_SUBJECT_ID)).pending).toBeUndefined();
    const journal = await harness.transactions.read(request(3));
    if (journal.transactionKind !== "review_decision") throw new Error("Expected review journal.");
    expect(journal.events.map((event) => event.event.kind)).toEqual([
      "version.promoted",
      "job.changed",
    ]);
  });

  it("rolls back by creating a new immutable current version and preserving source facts", async () => {
    const { harness, source, current, state } = await setupRollback({ pending: "delta" });
    const sourceBefore = await harness.versions.read(TEST_SUBJECT_ID, source.version.id);
    const result = await harness.service.rollback(
      {
        subjectId: TEST_SUBJECT_ID,
        targetVersionId: source.version.id,
        reason: "Restore the known profile.",
      },
      ACTOR,
      { requestId: request(4) },
    );

    expect(result.id).not.toBe(source.version.id);
    expect(result.id).not.toBe(current.version.id);
    expect(result).toMatchObject({
      parentId: current.version.id,
      creation: { kind: "rollback", targetVersionId: source.version.id },
      status: "current",
      actor: ACTOR,
    });
    const after = await harness.states.read(TEST_SUBJECT_ID);
    expect(after.generation).toBe(state.generation);
    expect(after.materialSetHash).toBe(state.materialSetHash);
    expect(after.materialManifest).toEqual(state.materialManifest);
    expect(after.currentVersionId).toBe(result.id);
    expect(after.pending).toMatchObject({
      baseVersionId: result.id,
      addedMaterialCount: 1,
      queuedAt: AT,
    });
    expect(after.pending?.jobId).not.toBe(state.pending?.jobId);
    expect(after.pending?.lease).toBeUndefined();

    const created = await harness.versions.read(TEST_SUBJECT_ID, result.id);
    expect(created.manifest).toEqual(source.manifest);
    expect(created.claims.claims).toEqual(source.claims.claims);
    expect(created.version.quality).toEqual(source.version.quality);
    expect(created.version.rendererVersion).toBe(source.version.rendererVersion);
    expect(created.version.subjectDisplayName).toBe(source.version.subjectDisplayName);
    expect(await harness.versions.read(TEST_SUBJECT_ID, source.version.id)).toEqual(sourceBefore);
    await expect(harness.currentProfiles.readExact(created)).resolves.toBeUndefined();
    const journal = await harness.transactions.read(request(4));
    expect(journal).toMatchObject({
      transactionKind: "rollback",
      state: "committed",
      targetVersionId: source.version.id,
      events: [
        {
          event: { kind: "version.rolled_back", versionId: result.id },
          reason: "Restore the known profile.",
          relatedVersionId: source.version.id,
        },
        { event: { kind: "job.changed" } },
      ],
    });
  });

  it("hard-rejects review and rollback conflicts without changing facts or projections", async () => {
    const candidateFixture = await setupCandidate();
    const candidateBefore = await factSnapshot(candidateFixture.harness);
    await expectCode(
      candidateFixture.harness.service.promote(
        {
          subjectId: TEST_SUBJECT_ID,
          candidateVersionId: candidateFixture.current.version.id,
        },
        ACTOR,
        { requestId: request(5) },
      ),
      "review_conflict",
    );
    await expectCode(
      candidateFixture.harness.service.rollback(
        {
          subjectId: TEST_SUBJECT_ID,
          targetVersionId: candidateFixture.current.version.id,
          reason: "Blocked while suspended.",
        },
        ACTOR,
        { requestId: request(6) },
      ),
      "review_conflict",
    );
    expect(await factSnapshot(candidateFixture.harness)).toEqual(candidateBefore);

    const leasedFixture = await setupRollback({ pending: "leased" });
    const leasedBefore = await factSnapshot(leasedFixture.harness);
    await expectCode(
      leasedFixture.harness.service.rollback(
        {
          subjectId: TEST_SUBJECT_ID,
          targetVersionId: leasedFixture.source.version.id,
          reason: "Blocked by lease.",
        },
        ACTOR,
        { requestId: request(7) },
      ),
      "lease_conflict",
    );
    expect(await factSnapshot(leasedFixture.harness)).toEqual(leasedBefore);

    const currentFixture = await setupRollback();
    for (const [targetVersionId, code] of [
      [currentFixture.current.version.id, "invalid_input"],
      [`version_${"f".repeat(64)}` as VersionId, "not_found"],
    ] as const) {
      const before = await factSnapshot(currentFixture.harness);
      await expectCode(
        currentFixture.harness.service.rollback(
          { subjectId: TEST_SUBJECT_ID, targetVersionId, reason: "Invalid target." },
          ACTOR,
          { requestId: request(code === "invalid_input" ? 8 : 9) },
        ),
        code,
      );
      expect(await factSnapshot(currentFixture.harness)).toEqual(before);
    }
  });

  it("refuses a rejected candidate as a later rollback source", async () => {
    const { harness, candidate } = await setupCandidate();
    await harness.service.reject(
      { subjectId: TEST_SUBJECT_ID, candidateVersionId: candidate.version.id },
      ACTOR,
      { requestId: request(10) },
    );
    const before = await factSnapshot(harness);
    await expectCode(
      harness.service.rollback(
        {
          subjectId: TEST_SUBJECT_ID,
          targetVersionId: candidate.version.id,
          reason: "Rejected target.",
        },
        ACTOR,
        { requestId: request(11) },
      ),
      "invalid_input",
    );
    expect(await factSnapshot(harness)).toEqual(before);
  });

  it("fails closed before writing when a rollback source lacks committed lineage", async () => {
    const { harness, source } = await setupRollback();
    const orphan = makeVersionArtifacts(harness.fixture, {
      parentId: source.version.id,
      claimTextSuffix: " Orphan.",
    });
    await publishVersionArtifacts(harness.fixture, orphan, request(114));
    const before = await factSnapshot(harness);

    await expectCode(
      harness.service.rollback(
        {
          subjectId: TEST_SUBJECT_ID,
          targetVersionId: orphan.version.id,
          reason: "This physical orphan is not historical fact.",
        },
        ACTOR,
        { requestId: request(23) },
      ),
      "storage_corrupt",
    );
    expect(await factSnapshot(harness)).toEqual(before);
  });

  it("fails closed before writing when a rollback source is outside the current lineage", async () => {
    const { harness, source } = await setupRollback();
    const divergent = makeVersionArtifacts(harness.fixture, {
      parentId: source.version.id,
      claimTextSuffix: " Divergent current branch.",
    });
    await publishVersionArtifacts(harness.fixture, divergent, request(152));
    await harness.events.write(
      TEST_SUBJECT_ID,
      eventRecord(91, "version.current", divergent.version.id),
    );
    const before = await factSnapshot(harness);

    await expectCode(
      harness.service.rollback(
        {
          subjectId: TEST_SUBJECT_ID,
          targetVersionId: divergent.version.id,
          reason: "A current branch is not historical under the active current.",
        },
        ACTOR,
        { requestId: request(44) },
      ),
      "storage_corrupt",
    );
    expect(await factSnapshot(harness)).toEqual(before);
  });

  it("makes concurrent promote/reject decisions single-winner under the subject CAS", async () => {
    let signalPrepared: (() => void) | undefined;
    let releaseCommit: (() => void) | undefined;
    const prepared = new Promise<void>((resolve) => {
      signalPrepared = resolve;
    });
    const mayCommit = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    const { harness, candidate } = await setupCandidate({
      serviceHooks: {
        afterPrepared() {
          signalPrepared?.();
          return mayCommit;
        },
      },
    });
    const promote = harness.service.promote(
      { subjectId: TEST_SUBJECT_ID, candidateVersionId: candidate.version.id },
      ACTOR,
      { requestId: request(12) },
    );
    await prepared;
    const reject = harness.service.reject(
      { subjectId: TEST_SUBJECT_ID, candidateVersionId: candidate.version.id },
      ACTOR,
      { requestId: request(13) },
    );
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 50);
    });
    releaseCommit?.();
    const settled = await Promise.allSettled([promote, reject]);
    expect(settled.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = settled.find((result) => result.status === "rejected");
    expect(rejected).toMatchObject({ reason: { code: "review_conflict" } });
    expect((await harness.states.read(TEST_SUBJECT_ID)).suspendedVersionId).toBeUndefined();
  });

  it("rejects a schema-valid committed review journal whose matching operation forges its result", async () => {
    const { harness, candidate } = await setupCandidate();
    const input = {
      subjectId: TEST_SUBJECT_ID,
      candidateVersionId: candidate.version.id,
      reason: "Verified candidate.",
    };
    const requestId = request(14);
    await harness.service.promote(input, ACTOR, { requestId });
    const terminal = await harness.transactions.read(requestId);
    if (terminal.transactionKind !== "review_decision" || terminal.method !== "promote") {
      throw new Error("Expected a committed promote journal.");
    }
    const { checksum: _operationChecksum, ...operationPayload } = terminal.operation;
    void _operationChecksum;
    const forgedOperation = sealFact<OperationRecord<"versions.promote">>({
      ...operationPayload,
      result: {
        ...operationPayload.result,
        actor: { kind: "sdk", id: "forged-review-result" },
      },
    });
    const { checksum: _journalChecksum, ...journalPayload } = terminal;
    void _journalChecksum;
    const forgedJournal = sealFact<ReviewDecisionTransactionRecord>({
      ...journalPayload,
      operation: forgedOperation,
    });
    await replaceFactFile(
      harness.layout.root,
      harness.layout.operationFile(requestId),
      forgedOperation,
      operationFactRuntimeSchema,
    );
    await replaceFactFile(
      harness.layout.root,
      harness.layout.transactionFile(requestId),
      forgedJournal,
      reviewTransactionRuntimeSchema,
    );

    await expectCode(harness.service.promote(input, ACTOR, { requestId }), "storage_corrupt");
  });

  it("rejects committed review replay when its durable decision event is missing", async () => {
    const { harness, candidate } = await setupCandidate();
    const input = {
      subjectId: TEST_SUBJECT_ID,
      candidateVersionId: candidate.version.id,
      reason: "Keep the terminal event exact.",
    };
    const requestId = request(24);
    await harness.service.promote(input, ACTOR, { requestId });
    const terminal = await harness.transactions.read(requestId);
    if (terminal.transactionKind !== "review_decision" || terminal.state !== "committed") {
      throw new Error("Expected a committed review journal.");
    }
    await rm(harness.layout.eventFile(TEST_SUBJECT_ID, terminal.events[0].eventId));

    await expectCode(harness.service.promote(input, ACTOR, { requestId }), "storage_corrupt");
  });

  it("rejects committed promote replay when its durable pending-rebase event is missing", async () => {
    const { harness, candidate } = await setupCandidate({ pending: "delta" });
    const input = {
      subjectId: TEST_SUBJECT_ID,
      candidateVersionId: candidate.version.id,
      reason: "Keep the complete terminal event tuple.",
    };
    const requestId = request(25);
    await harness.service.promote(input, ACTOR, { requestId });
    const terminal = await harness.transactions.read(requestId);
    if (
      terminal.transactionKind !== "review_decision" ||
      terminal.state !== "committed" ||
      terminal.events.length !== 2
    ) {
      throw new Error("Expected a committed promote journal with a pending-rebase event.");
    }
    await rm(harness.layout.eventFile(TEST_SUBJECT_ID, terminal.events[1].eventId));

    await expectCode(harness.service.promote(input, ACTOR, { requestId }), "storage_corrupt");
  });

  it("rejects committed review replay with an extra same-request durable event", async () => {
    const { harness, candidate } = await setupCandidate();
    const input = {
      subjectId: TEST_SUBJECT_ID,
      candidateVersionId: candidate.version.id,
      reason: "Keep the terminal event set exact.",
    };
    const requestId = request(27);
    await harness.service.promote(input, ACTOR, { requestId });
    await harness.events.write(
      TEST_SUBJECT_ID,
      sealFact<EventRecord>({
        schemaVersion: 1,
        eventId: eventIdSchema.parse(`event_${"f".repeat(32)}`),
        event: { kind: "job.changed", subjectId: TEST_SUBJECT_ID, at: AT },
        actor: ACTOR,
        requestId,
      }),
    );

    await expectCode(harness.service.promote(input, ACTOR, { requestId }), "storage_corrupt");
  });

  it("rejects a prepared review journal whose second event exists before its first", async () => {
    const { harness, candidate } = await setupCandidate({
      pending: "delta",
      serviceHooks: { afterFactCommit: failOnce() },
    });
    const input = {
      subjectId: TEST_SUBJECT_ID,
      candidateVersionId: candidate.version.id,
      reason: "Materialize events only as a prefix.",
    };
    const requestId = request(28);
    await expect(harness.service.promote(input, ACTOR, { requestId })).rejects.toThrow(
      "simulated process crash",
    );
    const prepared = await harness.transactions.read(requestId);
    if (
      prepared.transactionKind !== "review_decision" ||
      prepared.state !== "prepared" ||
      prepared.events.length !== 2
    ) {
      throw new Error("Expected a prepared promote journal with two events.");
    }
    await harness.events.write(TEST_SUBJECT_ID, prepared.events[1]);

    await expectCode(harness.service.promote(input, ACTOR, { requestId }), "storage_corrupt");
  });

  it("rejects a schema-valid committed rollback journal whose matching operation forges its result", async () => {
    const { harness, source } = await setupRollback();
    const input = {
      subjectId: TEST_SUBJECT_ID,
      targetVersionId: source.version.id,
      reason: "Restore verified history.",
    };
    const requestId = request(15);
    await harness.service.rollback(input, ACTOR, { requestId });
    const terminal = await harness.transactions.read(requestId);
    if (terminal.transactionKind !== "rollback" || terminal.state !== "committed") {
      throw new Error("Expected a committed rollback journal.");
    }
    const { checksum: _versionChecksum, ...versionPayload } = terminal.version;
    void _versionChecksum;
    const forgedVersion = sealFact<VersionRecord>({
      ...versionPayload,
      createdAt: LATER,
    });
    const { checksum: _operationChecksum, ...operationPayload } = terminal.operation;
    void _operationChecksum;
    const forgedOperation = sealFact<OperationRecord<"versions.rollback">>({
      ...operationPayload,
      result: {
        ...operationPayload.result,
        createdAt: LATER,
      },
      completedAt: LATER,
    });
    const rollbackEvent = terminal.events[0];
    const { checksum: _eventChecksum, ...eventPayload } = rollbackEvent;
    void _eventChecksum;
    const forgedEvent = sealFact<EventRecord>({
      ...eventPayload,
      event: { ...eventPayload.event, at: LATER },
    });
    const { checksum: _journalChecksum, ...journalPayload } = terminal;
    void _journalChecksum;
    const forgedJournalPayload = {
      ...journalPayload,
      version: forgedVersion,
      operation: forgedOperation,
      events: [forgedEvent],
      preparedAt: LATER,
      finishedAt: LATER,
    } as const;
    const forgedJournal = rollbackTransactionRecordSchema.parse({
      ...forgedJournalPayload,
      checksum: computeFactChecksum(forgedJournalPayload),
    }) as RollbackTransactionRecord;
    await replaceFactFile(
      harness.layout.root,
      harness.layout.operationFile(requestId),
      forgedOperation,
      operationFactRuntimeSchema,
    );
    await replaceFactFile(
      harness.layout.root,
      harness.layout.transactionFile(requestId),
      forgedJournal,
      rollbackTransactionRuntimeSchema,
    );

    await expectCode(harness.service.rollback(input, ACTOR, { requestId }), "storage_corrupt");
  });

  it("rejects committed rollback replay when its durable pending-rebase event is missing", async () => {
    const { harness, source } = await setupRollback({ pending: "delta" });
    const input = {
      subjectId: TEST_SUBJECT_ID,
      targetVersionId: source.version.id,
      reason: "Keep the complete rollback event tuple.",
    };
    const requestId = request(26);
    await harness.service.rollback(input, ACTOR, { requestId });
    const terminal = await harness.transactions.read(requestId);
    if (
      terminal.transactionKind !== "rollback" ||
      terminal.state !== "committed" ||
      terminal.events.length !== 2
    ) {
      throw new Error("Expected a committed rollback journal with a pending-rebase event.");
    }
    await rm(harness.layout.eventFile(TEST_SUBJECT_ID, terminal.events[1].eventId));

    await expectCode(harness.service.rollback(input, ACTOR, { requestId }), "storage_corrupt");
  });

  it("validates an aborted review journal semantically before repreparing it", async () => {
    const { harness, candidate } = await setupCandidate({
      serviceHooks: { afterPrepared: failOnce() },
    });
    const input = {
      subjectId: TEST_SUBJECT_ID,
      candidateVersionId: candidate.version.id,
      reason: "Validate the retained candidate.",
    };
    const requestId = request(18);
    await expect(harness.service.promote(input, ACTOR, { requestId })).rejects.toThrow(
      "simulated process crash",
    );
    await harness.recovery.reconcile(requestId);
    const aborted = await harness.transactions.read(requestId);
    if (
      aborted.transactionKind !== "review_decision" ||
      aborted.method !== "promote" ||
      aborted.state !== "aborted"
    ) {
      throw new Error("Expected an aborted review journal.");
    }
    const { checksum: _operationChecksum, ...operationPayload } = aborted.operation;
    void _operationChecksum;
    const forgedOperation = sealFact<OperationRecord<"versions.promote">>({
      ...operationPayload,
      result: {
        ...operationPayload.result,
        actor: { kind: "sdk", id: "forged-aborted-review-result" },
      },
    });
    const { checksum: _journalChecksum, ...journalPayload } = aborted;
    void _journalChecksum;
    const forgedJournal = sealFact<ReviewDecisionTransactionRecord>({
      ...journalPayload,
      operation: forgedOperation,
    });
    await replaceFactFile(
      harness.layout.root,
      harness.layout.transactionFile(requestId),
      forgedJournal,
      reviewTransactionRuntimeSchema,
    );
    const stateBefore = await readFile(harness.layout.stateFile(TEST_SUBJECT_ID));
    const journalBefore = await readFile(harness.layout.transactionFile(requestId));

    await expectCode(harness.service.promote(input, ACTOR, { requestId }), "storage_corrupt");
    expect(await readFile(harness.layout.stateFile(TEST_SUBJECT_ID))).toEqual(stateBefore);
    expect(await readFile(harness.layout.transactionFile(requestId))).toEqual(journalBefore);
    await expect(harness.operations.readOptional(requestId)).resolves.toBeUndefined();
  });

  it("validates aborted rollback artifacts semantically before version publication", async () => {
    const { harness, source } = await setupRollback({
      serviceHooks: { afterPrepared: failOnce() },
    });
    const input = {
      subjectId: TEST_SUBJECT_ID,
      targetVersionId: source.version.id,
      reason: "Validate the retained rollback copy.",
    };
    const requestId = request(19);
    await expect(harness.service.rollback(input, ACTOR, { requestId })).rejects.toThrow(
      "simulated process crash",
    );
    await harness.recovery.reconcile(requestId);
    const aborted = await harness.transactions.read(requestId);
    if (aborted.transactionKind !== "rollback" || aborted.state !== "aborted") {
      throw new Error("Expected an aborted rollback journal.");
    }
    const forgedQuality = { ...aborted.version.quality, maturity: "forming" as const };
    const { checksum: _versionChecksum, ...versionPayload } = aborted.version;
    void _versionChecksum;
    const forgedVersion = sealFact<VersionRecord>({
      ...versionPayload,
      quality: forgedQuality,
    });
    const { checksum: _operationChecksum, ...operationPayload } = aborted.operation;
    void _operationChecksum;
    const forgedOperation = sealFact<OperationRecord<"versions.rollback">>({
      ...operationPayload,
      result: { ...operationPayload.result, quality: forgedQuality },
    });
    const { checksum: _journalChecksum, ...journalPayload } = aborted;
    void _journalChecksum;
    const forgedJournalPayload = {
      ...journalPayload,
      version: forgedVersion,
      profile: { ...journalPayload.profile, quality: forgedQuality },
      operation: forgedOperation,
    } as const;
    const forgedJournal = rollbackTransactionRecordSchema.parse({
      ...forgedJournalPayload,
      checksum: computeFactChecksum(forgedJournalPayload),
    }) as RollbackTransactionRecord;
    await replaceFactFile(
      harness.layout.root,
      harness.layout.transactionFile(requestId),
      forgedJournal,
      rollbackTransactionRuntimeSchema,
    );
    const stateBefore = await readFile(harness.layout.stateFile(TEST_SUBJECT_ID));
    const journalBefore = await readFile(harness.layout.transactionFile(requestId));

    await expectCode(harness.service.rollback(input, ACTOR, { requestId }), "storage_corrupt");
    expect(await readFile(harness.layout.stateFile(TEST_SUBJECT_ID))).toEqual(stateBefore);
    expect(await readFile(harness.layout.transactionFile(requestId))).toEqual(journalBefore);
    await expect(harness.operations.readOptional(requestId)).resolves.toBeUndefined();
    expect(
      await exists(harness.layout.versionDirectory(TEST_SUBJECT_ID, forgedJournal.version.id)),
    ).toBe(false);
  });

  it("commits facts when Library reports a durable dirty marker", async () => {
    let attempts = 0;
    let completedHook = 0;
    let completedWriter = 0;
    const { harness, candidate } = await setupCandidate({
      library: {
        apply() {
          attempts += 1;
          return Promise.resolve("dirty" as const);
        },
        completeWriter() {
          completedWriter += 1;
          return Promise.resolve();
        },
      },
      recoveryHooks: {
        afterLibrary() {
          completedHook += 1;
        },
      },
    });
    const requestId = request(16);

    await expect(
      harness.service.promote(
        { subjectId: TEST_SUBJECT_ID, candidateVersionId: candidate.version.id },
        ACTOR,
        { requestId },
      ),
    ).resolves.toMatchObject({ id: candidate.version.id, status: "current" });
    expect(await harness.states.read(TEST_SUBJECT_ID)).toMatchObject({
      currentVersionId: candidate.version.id,
    });
    await expect(harness.transactions.read(requestId)).resolves.toMatchObject({
      state: "committed",
    });
    expect(attempts).toBe(1);
    expect(completedHook).toBe(1);
    expect(completedWriter).toBe(0);
  });

  it("fails closed before the terminal journal when Library fails before its dirty marker", async () => {
    const { harness, candidate } = await setupCandidate({
      library: {
        apply() {
          return Promise.reject(
            new DistillyError({
              code: "index_unavailable",
              message: "Library failed before its marker became durable.",
              retryable: true,
            }),
          );
        },
      },
    });
    const requestId = request(17);

    await expect(
      harness.service.promote(
        { subjectId: TEST_SUBJECT_ID, candidateVersionId: candidate.version.id },
        ACTOR,
        { requestId },
      ),
    ).rejects.toMatchObject({ code: "index_unavailable" });
    expect(await harness.states.read(TEST_SUBJECT_ID)).toMatchObject({
      currentVersionId: candidate.version.id,
    });
    await expect(harness.operations.read(requestId)).resolves.toMatchObject({
      method: "versions.promote",
    });
    await expect(harness.transactions.read(requestId)).resolves.toMatchObject({
      state: "prepared",
    });
  });

  it.each([
    "afterPrepared",
    "afterFactCommit",
    "afterOperation",
    "afterEvent",
    "afterCurrentProfile",
    "afterQueue",
    "afterLibrary",
    "afterReviewTerminal",
  ] as const)("recovers promote idempotently after %s", async (point) => {
    const fail = failOnce();
    const serviceHooks: ReviewServiceHooks =
      point === "afterPrepared"
        ? { afterPrepared: fail }
        : point === "afterFactCommit"
          ? { afterFactCommit: fail }
          : {};
    const recoveryHooks: RecoveryHooks =
      point === "afterOperation"
        ? { afterOperation: fail }
        : point === "afterEvent"
          ? { afterEvent: fail }
          : point === "afterCurrentProfile"
            ? { afterCurrentProfile: fail }
            : point === "afterQueue"
              ? { afterQueue: fail }
              : point === "afterLibrary"
                ? { afterLibrary: fail }
                : point === "afterReviewTerminal"
                  ? { afterReviewTerminal: fail }
                  : {};
    const { harness, candidate } = await setupCandidate({
      serviceHooks,
      recoveryHooks,
      ...(point === "afterLibrary"
        ? { library: { apply: () => Promise.resolve("clean" as const) } }
        : {}),
    });
    const input = { subjectId: TEST_SUBJECT_ID, candidateVersionId: candidate.version.id };
    await expect(harness.service.promote(input, ACTOR, { requestId: request(20) })).rejects.toThrow(
      "simulated process crash",
    );
    const attempted = await harness.transactions.read(request(20));
    if (attempted.transactionKind !== "review_decision")
      throw new Error("Expected review journal.");
    const result = await harness.service.promote(input, ACTOR, { requestId: request(20) });
    expect(result).toEqual(attempted.operation.result);
    await expect(harness.transactions.read(request(20))).resolves.toMatchObject({
      state: "committed",
    });
    expect(
      (await harness.events.list(TEST_SUBJECT_ID)).filter(
        (event) => event.requestId === request(20),
      ),
    ).toHaveLength(1);
  });

  it.each([
    "afterPrepared",
    "afterFactCommit",
    "afterOperation",
    "afterEvent",
    "afterQueue",
    "afterLibrary",
    "afterReviewTerminal",
  ] as const)("recovers reject idempotently after %s", async (point) => {
    const fail = failOnce();
    const serviceHooks: ReviewServiceHooks =
      point === "afterPrepared"
        ? { afterPrepared: fail }
        : point === "afterFactCommit"
          ? { afterFactCommit: fail }
          : {};
    const recoveryHooks: RecoveryHooks =
      point === "afterOperation"
        ? { afterOperation: fail }
        : point === "afterEvent"
          ? { afterEvent: fail }
          : point === "afterQueue"
            ? { afterQueue: fail }
            : point === "afterLibrary"
              ? { afterLibrary: fail }
              : point === "afterReviewTerminal"
                ? { afterReviewTerminal: fail }
                : {};
    const { harness, candidate } = await setupCandidate({
      serviceHooks,
      recoveryHooks,
      ...(point === "afterLibrary"
        ? { library: { apply: () => Promise.resolve("clean" as const) } }
        : {}),
    });
    const input = { subjectId: TEST_SUBJECT_ID, candidateVersionId: candidate.version.id };
    await expect(harness.service.reject(input, ACTOR, { requestId: request(21) })).rejects.toThrow(
      "simulated process crash",
    );
    const attempted = await harness.transactions.read(request(21));
    if (attempted.transactionKind !== "review_decision") {
      throw new Error("Expected review journal.");
    }
    const result = await harness.service.reject(input, ACTOR, { requestId: request(21) });
    expect(result).toEqual(attempted.operation.result);
    await expect(harness.transactions.read(request(21))).resolves.toMatchObject({
      state: "committed",
    });
    expect(
      (await harness.events.list(TEST_SUBJECT_ID)).filter(
        (event) => event.requestId === request(21),
      ),
    ).toHaveLength(1);
  });

  it.each([
    "afterPrepared",
    "afterVersionPrepared",
    "afterVersionPublished",
    "afterFactCommit",
    "afterOperation",
    "afterEvent",
    "afterCurrentProfile",
    "afterQueue",
    "afterLibrary",
    "afterRollbackTerminal",
  ] as const)("recovers rollback idempotently after %s", async (point) => {
    const fail = failOnce();
    const serviceHooks: ReviewServiceHooks =
      point === "afterPrepared"
        ? { afterPrepared: fail }
        : point === "afterVersionPrepared"
          ? { afterVersionPrepared: fail }
          : point === "afterVersionPublished"
            ? { afterVersionPublished: fail }
            : point === "afterFactCommit"
              ? { afterFactCommit: fail }
              : {};
    const recoveryHooks: RecoveryHooks =
      point === "afterOperation"
        ? { afterOperation: fail }
        : point === "afterEvent"
          ? { afterEvent: fail }
          : point === "afterCurrentProfile"
            ? { afterCurrentProfile: fail }
            : point === "afterQueue"
              ? { afterQueue: fail }
              : point === "afterLibrary"
                ? { afterLibrary: fail }
                : point === "afterRollbackTerminal"
                  ? { afterRollbackTerminal: fail }
                  : {};
    const { harness, source } = await setupRollback({
      serviceHooks,
      recoveryHooks,
      ...(point === "afterLibrary"
        ? { library: { apply: () => Promise.resolve("clean" as const) } }
        : {}),
    });
    const input = {
      subjectId: TEST_SUBJECT_ID,
      targetVersionId: source.version.id,
      reason: "Crash recovery rollback.",
    };
    await expect(
      harness.service.rollback(input, ACTOR, { requestId: request(30) }),
    ).rejects.toThrow("simulated process crash");
    const attempted = await harness.transactions.read(request(30));
    if (attempted.transactionKind !== "rollback") throw new Error("Expected rollback journal.");
    const result = await harness.service.rollback(input, ACTOR, { requestId: request(30) });
    expect(result).toEqual(attempted.operation.result);
    await expect(harness.transactions.read(request(30))).resolves.toMatchObject({
      state: "committed",
    });
    await expect(
      harness.versions.read(TEST_SUBJECT_ID, attempted.version.id),
    ).resolves.toMatchObject({
      version: { id: attempted.version.id },
    });
    expect(
      (await harness.events.list(TEST_SUBJECT_ID)).filter(
        (event) => event.requestId === request(30),
      ),
    ).toHaveLength(1);
    expect(
      await exists(
        legacyVersionStagingDirectory(
          harness.layout,
          request(30),
          TEST_SUBJECT_ID,
          attempted.version.id,
        ),
      ),
    ).toBe(false);
  });

  it.each(["previous", "target"] as const)(
    "rejects a prepared rollback whose source is outside the %s-state current lineage",
    async (visibleState) => {
      const { harness, source } = await setupRollback({
        serviceHooks: { afterPrepared: failOnce() },
      });
      const divergent = makeVersionArtifacts(harness.fixture, {
        parentId: source.version.id,
        claimTextSuffix: " Divergent current branch.",
      });
      const requestId = request(43);
      await expect(
        harness.service.rollback(
          {
            subjectId: TEST_SUBJECT_ID,
            targetVersionId: source.version.id,
            reason: "Prepare a valid rollback before hostile journal replacement.",
          },
          ACTOR,
          { requestId },
        ),
      ).rejects.toThrow("simulated process crash");
      const prepared = await harness.transactions.read(requestId);
      if (prepared.transactionKind !== "rollback" || prepared.state !== "prepared") {
        throw new Error("Expected a prepared rollback journal.");
      }
      await publishVersionArtifacts(harness.fixture, divergent, request(151));
      await harness.events.write(
        TEST_SUBJECT_ID,
        eventRecord(90, "version.current", divergent.version.id),
      );
      const forged = forgeRollbackSource(prepared, divergent);
      await replaceFactFile(
        harness.layout.root,
        harness.layout.transactionFile(requestId),
        forged,
        rollbackTransactionRuntimeSchema,
      );
      if (visibleState === "target") {
        const artifacts = {
          version: forged.version,
          manifest: forged.materialManifest,
          claims: forged.claims,
          profile: forged.profile,
          prompt: forged.prompt,
        };
        await harness.fixture.staging.prepare(requestId, artifacts);
        await harness.fixture.staging.publish(requestId, artifacts);
        await harness.states.write(forged.targetState);
      }
      const stateBefore = await readFile(harness.layout.stateFile(TEST_SUBJECT_ID));
      const journalBefore = await readFile(harness.layout.transactionFile(requestId));

      await expectCode(harness.recovery.reconcile(requestId), "storage_corrupt");
      expect(await readFile(harness.layout.stateFile(TEST_SUBJECT_ID))).toEqual(stateBefore);
      expect(await readFile(harness.layout.transactionFile(requestId))).toEqual(journalBefore);
      await expect(harness.operations.readOptional(requestId)).resolves.toBeUndefined();
      expect(
        (await harness.events.list(TEST_SUBJECT_ID)).filter(
          (record) => record.requestId === requestId,
        ),
      ).toHaveLength(0);
    },
  );

  it("fails closed on a third review state and leaves the prepared journal intact", async () => {
    const { harness, candidate, state } = await setupCandidate({
      serviceHooks: { afterPrepared: failOnce() },
    });
    await expect(
      harness.service.promote(
        { subjectId: TEST_SUBJECT_ID, candidateVersionId: candidate.version.id },
        ACTOR,
        { requestId: request(40) },
      ),
    ).rejects.toThrow("simulated process crash");
    await harness.states.write(
      sealFact<SubjectStateRecord>({ ...state, generation: state.generation + 1 }),
    );
    await expectCode(harness.recovery.reconcile(request(40)), "storage_corrupt");
    await expect(harness.transactions.read(request(40))).resolves.toMatchObject({
      state: "prepared",
    });
  });

  it("fails closed on a third rollback state without publishing its new version", async () => {
    const { harness, source, state } = await setupRollback({
      serviceHooks: { afterPrepared: failOnce() },
    });
    await expect(
      harness.service.rollback(
        {
          subjectId: TEST_SUBJECT_ID,
          targetVersionId: source.version.id,
          reason: "Third-state guard.",
        },
        ACTOR,
        { requestId: request(42) },
      ),
    ).rejects.toThrow("simulated process crash");
    const journal = await harness.transactions.read(request(42));
    if (journal.transactionKind !== "rollback") throw new Error("Expected rollback journal.");
    await harness.states.write(
      sealFact<SubjectStateRecord>({ ...state, generation: state.generation + 1 }),
    );

    await expectCode(harness.recovery.reconcile(request(42)), "storage_corrupt");
    await expect(harness.transactions.read(request(42))).resolves.toMatchObject({
      state: "prepared",
    });
    expect(await exists(harness.layout.versionDirectory(TEST_SUBJECT_ID, journal.version.id))).toBe(
      false,
    );
  });

  it("does not delete a rollback version referenced by an independent lineage event", async () => {
    const { harness, source } = await setupRollback({
      serviceHooks: { afterVersionPublished: failOnce() },
    });
    await expect(
      harness.service.rollback(
        {
          subjectId: TEST_SUBJECT_ID,
          targetVersionId: source.version.id,
          reason: "Reference safety.",
        },
        ACTOR,
        { requestId: request(41) },
      ),
    ).rejects.toThrow("simulated process crash");
    const journal = await harness.transactions.read(request(41));
    if (journal.transactionKind !== "rollback") throw new Error("Expected rollback journal.");
    await harness.events.write(
      TEST_SUBJECT_ID,
      sealFact<EventRecord>({
        schemaVersion: 1,
        eventId: eventIdSchema.parse(`event_${"f".repeat(32)}`),
        event: {
          kind: "version.current",
          subjectId: TEST_SUBJECT_ID,
          versionId: journal.version.id,
          at: AT,
        },
        actor: { kind: "system", id: "independent-lineage" },
      }),
    );
    await expectCode(harness.recovery.reconcile(request(41)), "storage_corrupt");
    expect(await exists(harness.layout.versionDirectory(TEST_SUBJECT_ID, journal.version.id))).toBe(
      true,
    );
    await expect(harness.transactions.read(request(41))).resolves.toMatchObject({
      state: "prepared",
    });
  });
});
