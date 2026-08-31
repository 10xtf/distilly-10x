import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  DistillyError,
  briefMaterialRefSchema,
  facetPathSchema,
  isoDateTimeSchema,
  requestIdSchema,
  type ActorContext,
  type ClientSessionContext,
  type CommitInput,
  type DistillCommitTransactionRecord,
  type EventId,
  type IngestInput,
  type IsoDateTime,
  type JobId,
  type LeaseId,
  type LeaseOwnerId,
  type RequestId,
  type SpaceId,
  type SubjectId,
} from "@distilly/protocol";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Clock } from "../defaults/system-clock.js";
import { FileEventStore } from "../facts/event-store.js";
import { FileMaterialStore } from "../facts/material-store.js";
import { FileOperationStore } from "../facts/operation-store.js";
import { FileSpaceStore } from "../facts/space-store.js";
import { FileSubjectStore } from "../facts/subject-store.js";
import { FileTransactionStore } from "../testing/legacy-file-transaction-store.test.fixture.js";
import { FileVersionStore } from "../facts/version-store.js";
import { Layout } from "../layout.js";
import type { IdGenerator } from "../ports/id-generator.js";
import {
  createLegacyFileEngineTestSupport,
  type LegacyFileEngineTestSupport,
} from "../testing/legacy-file-engine.test.fixture.js";

const TIMES = [
  "2026-08-21T08:00:00.000Z",
  "2026-08-21T08:01:00.000Z",
  "2026-08-21T08:02:00.000Z",
  "2026-08-21T08:03:00.000Z",
  "2026-08-21T08:04:00.000Z",
].map((value) => isoDateTimeSchema.parse(value));
const ACTOR: ActorContext = { kind: "sdk", id: "step10-composition-test" };
const roots: string[] = [];

class MutableClock implements Clock {
  current = TIMES[0]!;

  now(): IsoDateTime {
    return this.current;
  }
}

class SequenceIds implements IdGenerator {
  private subject = 1;
  private space = 1;
  private job = 1;
  private lease = 1;
  private owner = 1;
  private event = 1;

  subjectId(): SubjectId {
    return `subject_${(this.subject++).toString(16).padStart(32, "0")}` as SubjectId;
  }

  spaceId(): SpaceId {
    return `space_${(this.space++).toString(16).padStart(32, "0")}` as SpaceId;
  }

  jobId(): JobId {
    return `job_${(this.job++).toString(16).padStart(32, "0")}` as JobId;
  }

  leaseId(): LeaseId {
    return `lease_${(this.lease++).toString(16).padStart(32, "0")}` as LeaseId;
  }

  leaseOwnerId(): LeaseOwnerId {
    return `lease_owner_${(this.owner++).toString(16).padStart(32, "0")}` as LeaseOwnerId;
  }

  eventId(): EventId {
    return `event_${(this.event++).toString(16).padStart(32, "0")}` as EventId;
  }
}

const request = (digit: number): RequestId =>
  requestIdSchema.parse(`req_${digit.toString(16).padStart(32, "0")}`);

const session = (): ClientSessionContext => ({
  actor: ACTOR,
  leaseOwner: `lease_owner_${"f".repeat(32)}` as LeaseOwnerId,
  capacity: {
    maximumInputTokens: 1_000_000,
    maximumToolResultBytes: 1_000_000,
    source: "sdk_explicit",
  },
});

const material = (digit: number, content: string): IngestInput["materials"][number] => ({
  clientRef: `lifecycle-source-${digit}`,
  kind: "web",
  content,
  source: {
    uri: `https://example.com/lifecycle-source-${digit}`,
    medium: "article",
    access: "public",
    role: "reference",
    capturedAt: TIMES[0]!,
  },
  derivation: { kind: "native_text" },
});

const commitInput = (
  briefing: Awaited<ReturnType<LegacyFileEngineTestSupport["leases"]["brief"]>>,
  patch: CommitInput["patch"],
): CommitInput => ({
  jobId: briefing.job.id,
  generation: briefing.job.generation,
  leaseId: briefing.lease.id,
  briefContractDigest: briefing.contract.digest,
  materialSetHash: briefing.job.materialSetHash,
  ...(briefing.job.baseVersionId === undefined
    ? {}
    : { baseVersionId: briefing.job.baseVersionId }),
  patch,
});

const initialPatch = (): CommitInput["patch"] => ({
  operations: [
    {
      op: "add",
      claim: {
        facet: facetPathSchema.parse("identity.biography"),
        text: "Mira designs reliable local-first research systems.",
        evidence: [
          {
            kind: "brief_material",
            materialRef: briefMaterialRefSchema.parse("m001"),
            quote: "Mira designs reliable local-first research systems.",
          },
        ],
      },
    },
  ],
});

const suspendedPatch = (): CommitInput["patch"] => ({
  operations: [
    {
      op: "add",
      claim: {
        facet: facetPathSchema.parse("voice.explanation_style"),
        text: "Mira starts explanations with a concrete recovery example.",
        evidence: [
          {
            kind: "brief_material",
            materialRef: briefMaterialRefSchema.parse("m001"),
            quote: "Mira starts explanations with a concrete recovery example.",
          },
        ],
      },
    },
  ],
  reviewRequest: { note: "Review the new voice claim." },
});

const facts = (root: string) => {
  const layout = new Layout(root);
  const spaces = new FileSpaceStore(layout);
  const subjects = new FileSubjectStore(layout, spaces);
  const materials = new FileMaterialStore(layout, subjects);
  return {
    layout,
    events: new FileEventStore(layout, subjects),
    operations: new FileOperationStore(layout, subjects),
    transactions: new FileTransactionStore(layout),
    versions: new FileVersionStore(layout, materials),
  };
};

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("review and rollback composition", { timeout: 60_000 }, () => {
  it("does not scan terminal journals on a clean post-startup Library read", async () => {
    const list = vi.spyOn(FileTransactionStore.prototype, "list");
    try {
      const root = await mkdtemp(join(tmpdir(), "distilly-library-clean-path-"));
      roots.push(root);
      const composition = await createLegacyFileEngineTestSupport({
        root,
        clock: new MutableClock(),
        ids: new SequenceIds(),
      });
      await composition.libraryProjection.rebuild();
      list.mockClear();

      await expect(composition.library.list({})).resolves.toEqual({ items: [] });
      expect(list).not.toHaveBeenCalled();
    } finally {
      list.mockRestore();
    }
  });

  it("runs ingest through suspended promotion and immutable rollback with exact projections", async () => {
    const root = await mkdtemp(join(tmpdir(), "distilly-review-composition-"));
    roots.push(root);
    const clock = new MutableClock();
    const composition = await createLegacyFileEngineTestSupport({
      root,
      clock,
      ids: new SequenceIds(),
    });
    await expect(composition.libraryProjection.rebuild()).resolves.toMatchObject({ subjects: 0 });

    const created = await composition.ingest.ingest(
      {
        subject: {
          kind: "create",
          input: {
            displayName: "Mira Chen",
            aliases: ["Mira"],
            identityHints: [{ kind: "url", value: "https://example.com/mira" }],
          },
        },
        materials: [material(1, "Mira designs reliable local-first research systems.")],
        enqueue: "now",
      },
      ACTOR,
      { requestId: request(1) },
    );
    if (created.job === undefined) throw new Error("Expected an initial pending job.");
    const firstBrief = await composition.leases.brief({ jobId: created.job.id }, session(), {
      requestId: request(2),
    });
    const first = await composition.commits.commit(
      commitInput(firstBrief, initialPatch()),
      session(),
      { requestId: request(3) },
    );
    if (first.kind !== "current") throw new Error("Expected the first current version.");

    clock.current = TIMES[1]!;
    const incremental = await composition.ingest.ingest(
      {
        subject: { kind: "existing", subjectId: created.subject.id },
        materials: [material(2, "Mira starts explanations with a concrete recovery example.")],
        enqueue: "now",
      },
      ACTOR,
      { requestId: request(4) },
    );
    if (incremental.job === undefined) throw new Error("Expected an incremental pending job.");
    const secondBrief = await composition.leases.brief({ jobId: incremental.job.id }, session(), {
      requestId: request(5),
    });
    const suspended = await composition.commits.commit(
      commitInput(secondBrief, suspendedPatch()),
      session(),
      { requestId: request(6) },
    );
    if (suspended.kind !== "suspended") throw new Error("Expected a suspended candidate.");
    await expect(
      composition.reviews.list({ subjectId: created.subject.id }),
    ).resolves.toMatchObject({
      items: [
        {
          candidate: { id: suspended.candidate.id, status: "suspended" },
          current: { id: first.version.id, status: "current" },
        },
      ],
    });

    clock.current = TIMES[2]!;
    const whileSuspended = await composition.ingest.ingest(
      {
        subject: { kind: "existing", subjectId: created.subject.id },
        materials: [material(3, "Mira later publishes a recovery checklist.")],
        enqueue: "now",
      },
      ACTOR,
      { requestId: request(7) },
    );
    if (whileSuspended.job === undefined) throw new Error("Expected pending work while suspended.");
    expect(whileSuspended.job).toMatchObject({
      baseVersionId: first.version.id,
      addedMaterialCount: 2,
    });

    clock.current = TIMES[3]!;
    const promoted = await composition.review.promote(
      {
        subjectId: created.subject.id,
        candidateVersionId: suspended.candidate.id,
        reason: "Candidate evidence reviewed.",
      },
      ACTOR,
      { requestId: request(8) },
    );
    expect(promoted).toMatchObject({ id: suspended.candidate.id, status: "current" });
    await expect(composition.reviews.list({ subjectId: created.subject.id })).resolves.toEqual({
      items: [],
    });
    const promotedProfile = await composition.profiles.get({ subjectId: created.subject.id });
    expect(promotedProfile).toMatchObject({ versionId: suspended.candidate.id });
    expect(promotedProfile.claims).toHaveLength(2);
    const promotedQueue = await composition.leases.pending({ subjectId: created.subject.id });
    expect(promotedQueue).toHaveLength(1);
    expect(promotedQueue[0]).toMatchObject({
      baseVersionId: suspended.candidate.id,
      addedMaterialCount: 1,
      state: "pending",
    });
    expect(promotedQueue[0]?.id).not.toBe(whileSuspended.job.id);
    const diff = await composition.versions.diff({
      subjectId: created.subject.id,
      before: first.version.id,
      after: suspended.candidate.id,
    });
    expect(diff.added).toHaveLength(1);

    const stored = facts(root);
    const firstBeforeRollback = await stored.versions.read(created.subject.id, first.version.id);
    const candidateBeforeRollback = await stored.versions.read(
      created.subject.id,
      suspended.candidate.id,
    );

    clock.current = TIMES[4]!;
    const rolledBack = await composition.review.rollback(
      {
        subjectId: created.subject.id,
        targetVersionId: first.version.id,
        reason: "Restore the verified baseline.",
      },
      ACTOR,
      { requestId: request(9) },
    );
    expect(rolledBack.id).not.toBe(first.version.id);
    expect(rolledBack).toMatchObject({
      parentId: suspended.candidate.id,
      creation: { kind: "rollback", targetVersionId: first.version.id },
      status: "current",
    });
    expect(await stored.versions.read(created.subject.id, first.version.id)).toEqual(
      firstBeforeRollback,
    );
    expect(await stored.versions.read(created.subject.id, suspended.candidate.id)).toEqual(
      candidateBeforeRollback,
    );
    const rollbackVersion = await stored.versions.read(created.subject.id, rolledBack.id);
    expect(rollbackVersion.manifest).toEqual(firstBeforeRollback.manifest);
    expect(rollbackVersion.claims.claims).toEqual(firstBeforeRollback.claims.claims);
    expect(await composition.profiles.get({ subjectId: created.subject.id })).toEqual(
      rollbackVersion.profile,
    );
    expect(await readFile(stored.layout.currentProfileFile(created.subject.id), "utf8")).toBe(
      rollbackVersion.profile.rendered,
    );

    const finalQueue = await composition.leases.pending({ subjectId: created.subject.id });
    expect(finalQueue).toHaveLength(1);
    expect(finalQueue[0]).toMatchObject({
      baseVersionId: rolledBack.id,
      addedMaterialCount: 2,
      state: "pending",
    });
    expect(finalQueue[0]?.id).not.toBe(promotedQueue[0]?.id);
    const library = await composition.library.list({});
    expect(library.items).toHaveLength(1);
    expect(library.items[0]).toMatchObject({
      subject: { id: created.subject.id, currentVersionId: rolledBack.id },
      status: { pendingJobId: finalQueue[0]?.id },
      pendingJobs: 1,
      suspendedVersions: 0,
      newMaterialCount: 2,
      lastChangedAt: TIMES[4],
    });
    expect(library.items[0]?.currentQuality).toEqual(first.version.quality);

    const versions = await composition.versions.list({ subjectId: created.subject.id });
    expect(new Map(versions.items.map((version) => [version.id, version.status]))).toEqual(
      new Map([
        [first.version.id, "historical"],
        [suspended.candidate.id, "historical"],
        [rolledBack.id, "current"],
      ]),
    );
    const lineage = await composition.versions.lineage({ subjectId: created.subject.id });
    expect(lineage.items.map((event) => event.kind)).toEqual(
      expect.arrayContaining(["created", "suspended", "promoted", "rolled_back"]),
    );
    expect(lineage.items.find((event) => event.kind === "promoted")).toMatchObject({
      versionId: suspended.candidate.id,
      reason: "Candidate evidence reviewed.",
    });
    expect(lineage.items.find((event) => event.kind === "rolled_back")).toMatchObject({
      versionId: rolledBack.id,
      relatedVersionId: first.version.id,
      reason: "Restore the verified baseline.",
    });

    expect(await stored.operations.list()).toHaveLength(9);
    expect(await stored.transactions.list()).toHaveLength(6);
    await expect(stored.transactions.read(request(8))).resolves.toMatchObject({
      transactionKind: "review_decision",
      state: "committed",
    });
    await expect(stored.transactions.read(request(9))).resolves.toMatchObject({
      transactionKind: "rollback",
      state: "committed",
    });
    const events = await stored.events.list(created.subject.id);
    expect(events.filter((event) => event.requestId === request(8))).toHaveLength(2);
    expect(events.filter((event) => event.requestId === request(9))).toHaveLength(2);

    const foreign = await composition.ingest.ingest(
      {
        subject: { kind: "create", input: { displayName: "Foreign rollback subject" } },
        materials: [material(20, "Mira designs reliable local-first research systems.")],
        enqueue: "now",
      },
      ACTOR,
      { requestId: request(10) },
    );
    if (foreign.job === undefined) throw new Error("Expected the foreign subject pending job.");
    const foreignBrief = await composition.leases.brief({ jobId: foreign.job.id }, session(), {
      requestId: request(11),
    });
    const foreignCommit = await composition.commits.commit(
      commitInput(foreignBrief, initialPatch()),
      session(),
      { requestId: request(12) },
    );
    if (foreignCommit.kind !== "current") throw new Error("Expected a foreign current version.");
    const stateBeforeForeignRollback = await readFile(stored.layout.stateFile(created.subject.id));
    try {
      await composition.review.rollback(
        {
          subjectId: created.subject.id,
          targetVersionId: foreignCommit.version.id,
          reason: "Must not cross subject ownership.",
        },
        ACTOR,
        { requestId: request(13) },
      );
      throw new Error("Expected invalid_input.");
    } catch (error) {
      expect(error).toBeInstanceOf(DistillyError);
      expect(error).toMatchObject({ code: "invalid_input", retryable: false });
    }
    expect(await readFile(stored.layout.stateFile(created.subject.id))).toEqual(
      stateBeforeForeignRollback,
    );
    await expect(stored.operations.readOptional(request(13))).resolves.toBeUndefined();
    await expect(stored.transactions.readOptional(request(13))).resolves.toBeUndefined();
  });

  it("does not expose a physically published candidate before its state commit point", async () => {
    const root = await mkdtemp(join(tmpdir(), "distilly-committed-read-composition-"));
    roots.push(root);
    const clock = new MutableClock();
    let publishCount = 0;
    let candidateTransaction: DistillCommitTransactionRecord | undefined;
    let signalPublished: (() => void) | undefined;
    let releaseCommit: (() => void) | undefined;
    const published = new Promise<void>((resolve) => {
      signalPublished = resolve;
    });
    const mayCommit = new Promise<void>((resolve) => {
      releaseCommit = resolve;
    });
    const composition = await createLegacyFileEngineTestSupport({
      root,
      clock,
      ids: new SequenceIds(),
      commitHooks: {
        afterVersionPublished(transaction) {
          publishCount += 1;
          if (publishCount !== 2) return;
          candidateTransaction = transaction;
          signalPublished?.();
          return mayCommit;
        },
      },
    });
    await composition.libraryProjection.rebuild();
    const created = await composition.ingest.ingest(
      {
        subject: {
          kind: "create",
          input: { displayName: "Mira Chen Read Barrier" },
        },
        materials: [material(10, "Mira designs reliable local-first research systems.")],
        enqueue: "now",
      },
      ACTOR,
      { requestId: request(20) },
    );
    if (created.job === undefined) throw new Error("Expected an initial pending job.");
    const firstBrief = await composition.leases.brief({ jobId: created.job.id }, session(), {
      requestId: request(21),
    });
    const first = await composition.commits.commit(
      commitInput(firstBrief, initialPatch()),
      session(),
      { requestId: request(22) },
    );
    if (first.kind !== "current") throw new Error("Expected the first current version.");

    clock.current = TIMES[1]!;
    const incremental = await composition.ingest.ingest(
      {
        subject: { kind: "existing", subjectId: created.subject.id },
        materials: [material(11, "Mira starts explanations with a concrete recovery example.")],
        enqueue: "now",
      },
      ACTOR,
      { requestId: request(23) },
    );
    if (incremental.job === undefined) throw new Error("Expected an incremental pending job.");
    const secondBrief = await composition.leases.brief({ jobId: incremental.job.id }, session(), {
      requestId: request(24),
    });
    const committing = composition.commits.commit(
      commitInput(secondBrief, suspendedPatch()),
      session(),
      { requestId: request(25) },
    );
    await published;
    const transaction = candidateTransaction;
    if (transaction === undefined) throw new Error("Expected the blocked candidate transaction.");
    const candidateVersionId = transaction.version.id;

    const reads: Promise<unknown>[] = [
      composition.versions.list({ subjectId: created.subject.id }),
      composition.profiles.get({
        subjectId: created.subject.id,
        versionId: candidateVersionId,
      }),
      composition.materials.list({
        subjectId: created.subject.id,
        atVersionId: candidateVersionId,
      }),
      composition.versions.diff({
        subjectId: created.subject.id,
        before: first.version.id,
        after: candidateVersionId,
      }),
    ];
    const early = await Promise.race([
      Promise.allSettled(reads),
      new Promise<undefined>((resolve) => {
        setTimeout(() => resolve(undefined), 1_000);
      }),
    ]);
    try {
      expect(early).toBeDefined();
      for (const result of early ?? []) {
        expect(result.status).toBe("rejected");
        if (result.status === "rejected") {
          expect(result.reason).toBeInstanceOf(DistillyError);
          expect(result.reason).toMatchObject({ code: "busy", retryable: true });
        }
      }
    } finally {
      releaseCommit?.();
    }

    const committed = await committing;
    if (committed.kind !== "suspended") throw new Error("Expected a suspended candidate.");
    const visibleVersions = await composition.versions.list({ subjectId: created.subject.id });
    expect(visibleVersions.items).toContainEqual(
      expect.objectContaining({ id: candidateVersionId, status: "suspended" }),
    );
    await expect(
      composition.profiles.get({
        subjectId: created.subject.id,
        versionId: candidateVersionId,
      }),
    ).resolves.toMatchObject({ versionId: candidateVersionId });
    const visibleMaterials = await composition.materials.list({
      subjectId: created.subject.id,
      atVersionId: candidateVersionId,
    });
    expect(visibleMaterials.items).toHaveLength(2);
    expect(
      visibleMaterials.items.every((item) => item.grouping.versionId === candidateVersionId),
    ).toBe(true);
    const visibleDiff = await composition.versions.diff({
      subjectId: created.subject.id,
      before: first.version.id,
      after: candidateVersionId,
    });
    expect(visibleDiff.added).toHaveLength(1);
  });

  it("keeps Library rebuild linearizable with a committing writer", async () => {
    const root = await mkdtemp(join(tmpdir(), "distilly-library-writer-barrier-"));
    roots.push(root);
    const clock = new MutableClock();
    let blockVersionPublish = false;
    let signalPublished: (() => void) | undefined;
    let releasePublish: (() => void) | undefined;
    const published = new Promise<void>((resolve) => {
      signalPublished = resolve;
    });
    const mayPublish = new Promise<void>((resolve) => {
      releasePublish = resolve;
    });
    const composition = await createLegacyFileEngineTestSupport({
      root,
      clock,
      ids: new SequenceIds(),
      commitHooks: {
        afterVersionPublished() {
          if (!blockVersionPublish) return;
          blockVersionPublish = false;
          signalPublished?.();
          return mayPublish;
        },
      },
    });
    await composition.libraryProjection.rebuild();
    const reader = await createLegacyFileEngineTestSupport({
      root,
      clock,
      ids: new SequenceIds(),
    });
    const created = await composition.ingest.ingest(
      {
        subject: { kind: "create", input: { displayName: "Mira Chen Library Barrier" } },
        materials: [material(40, "Mira designs reliable local-first research systems.")],
        enqueue: "now",
      },
      ACTOR,
      { requestId: request(40) },
    );
    if (created.job === undefined) throw new Error("Expected an initial pending job.");
    const firstBrief = await composition.leases.brief({ jobId: created.job.id }, session(), {
      requestId: request(41),
    });
    const first = await composition.commits.commit(
      commitInput(firstBrief, initialPatch()),
      session(),
      { requestId: request(42) },
    );
    if (first.kind !== "current") throw new Error("Expected the first current version.");

    clock.current = TIMES[1]!;
    const incremental = await composition.ingest.ingest(
      {
        subject: { kind: "existing", subjectId: created.subject.id },
        materials: [material(41, "Mira starts explanations with a concrete recovery example.")],
        enqueue: "now",
      },
      ACTOR,
      { requestId: request(43) },
    );
    if (incremental.job === undefined) throw new Error("Expected an incremental pending job.");
    const secondBrief = await composition.leases.brief({ jobId: incremental.job.id }, session(), {
      requestId: request(44),
    });
    blockVersionPublish = true;
    const committing = composition.commits.commit(
      commitInput(secondBrief, suspendedPatch()),
      session(),
      { requestId: request(45) },
    );
    await published;
    try {
      await expect(reader.libraryProjection.rebuild()).rejects.toMatchObject({
        code: "busy",
        retryable: true,
      });
      await expect(readFile(new Layout(root).libraryDirtyFile())).rejects.toMatchObject({
        code: "ENOENT",
      });
    } finally {
      releasePublish?.();
    }
    const suspended = await committing;
    if (suspended.kind !== "suspended") throw new Error("Expected a suspended candidate.");
    await expect(reader.library.list({ hasSuspended: true })).resolves.toMatchObject({
      items: [expect.objectContaining({ suspendedVersions: 1 })],
    });
    await expect(reader.libraryProjection.rebuild()).resolves.toMatchObject({ subjects: 1 });
  });
});
