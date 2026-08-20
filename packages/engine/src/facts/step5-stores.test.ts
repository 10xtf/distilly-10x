import {
  BUILTIN_PEOPLE_SPACE_ID,
  DistillyError,
  factChecksumSchema,
  isoDateTimeSchema,
  materialIdSchema,
  materialSetHashSchema,
  operationFactSchema,
  provenanceDigestSchema,
  requestIdSchema,
  spaceIdSchema,
  spaceRecordSchema,
  subjectIdSchema,
  transactionRecordSchema,
  versionIdSchema,
  versionMaterialManifestSchema,
  versionRecordSchema,
} from "@distilly/protocol";
import type {
  DistillyErrorCode,
  IngestTransactionRecord,
  MaterialRecord,
  OperationFact,
  OperationRecord,
  OperationTombstoneRecord,
  RuntimeSchema,
  SpaceRecord,
  SubjectRecord,
  SubjectSummary,
  VersionMaterialEntry,
  VersionMaterialManifest,
  VersionRecord,
} from "@distilly/protocol";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Layout } from "../layout.js";
import { computeFactChecksum, sealFact } from "./checksum.js";
import {
  deriveMaterialId,
  digestContent,
  digestMaterialProvenance,
  hashMaterialSet,
} from "./digests.js";
import { createFactFile, replaceFactFile } from "./fact-file.js";
import { FileMaterialStore } from "./material-store.js";
import { FileOperationStore } from "./operation-store.js";
import { FileSpaceStore } from "./space-store.js";
import { FileSubjectStore } from "./subject-store.js";
import { FileTransactionStore } from "./transaction-store.js";
import { FileVersionManifestStore } from "./version-manifest-store.js";

const ZERO_32 = "0".repeat(32);
const ONE_32 = "1".repeat(32);
const TWO_32 = "2".repeat(32);
const ZERO_64 = "0".repeat(64);
const ONE_64 = "1".repeat(64);
const SPACE_ID = spaceIdSchema.parse(`space_${ZERO_32}`);
const OTHER_SPACE_ID = spaceIdSchema.parse(`space_${ONE_32}`);
const SUBJECT_ID = subjectIdSchema.parse(`subject_${ZERO_32}`);
const OTHER_SUBJECT_ID = subjectIdSchema.parse(`subject_${ONE_32}`);
const REQUEST_ID = requestIdSchema.parse(`req_${ZERO_32}`);
const OTHER_REQUEST_ID = requestIdSchema.parse(`req_${ONE_32}`);
const THIRD_REQUEST_ID = requestIdSchema.parse(`req_${TWO_32}`);
const VERSION_ID = versionIdSchema.parse(`version_${ZERO_64}`);
const OTHER_VERSION_ID = versionIdSchema.parse(`version_${ONE_64}`);
const AT = isoDateTimeSchema.parse("2026-08-20T00:00:00.000Z");
const LATER = isoDateTimeSchema.parse("2026-08-20T00:01:00.000Z");
const SET_HASH = materialSetHashSchema.parse(`set_sha256_${ZERO_64}`);
const OTHER_CHECKSUM = factChecksumSchema.parse(`fact_sha256_${ONE_64}`);
const VERSION_CONTENT = "Version baseline evidence.\n";

const OPERATION_FACT_SCHEMA: RuntimeSchema<OperationFact> = {
  parse(value) {
    return operationFactSchema.parse(value) as OperationFact;
  },
};
const TRANSACTION_SCHEMA: RuntimeSchema<IngestTransactionRecord> = {
  parse(value) {
    return transactionRecordSchema.parse(value) as IngestTransactionRecord;
  },
};
const VERSION_SCHEMA: RuntimeSchema<VersionRecord> = {
  parse(value) {
    return versionRecordSchema.parse(value) as VersionRecord;
  },
};
const VERSION_MANIFEST_SCHEMA: RuntimeSchema<VersionMaterialManifest> = {
  parse(value) {
    return versionMaterialManifestSchema.parse(value);
  },
};

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const createRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-step5-stores-"));
  roots.push(root);
  return root;
};

const expectCode = async (promise: Promise<unknown>, code: DistillyErrorCode): Promise<void> => {
  try {
    await promise;
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(DistillyError);
    expect(error).toMatchObject({ code });
  }
};

const makeSpace = (id = SPACE_ID, displayName = "People"): SpaceRecord =>
  sealFact<SpaceRecord>({ schemaVersion: 1, id, displayName, kind: "people" });

const makeSubject = (id = SUBJECT_ID, spaceId = SPACE_ID, displayName = "Ada"): SubjectRecord =>
  sealFact<SubjectRecord>({
    schemaVersion: 1,
    id,
    spaceId,
    displayName,
    aliases: [],
    identityHints: [],
    lifecycle: "active",
  });

const makeMaterial = (): MaterialRecord => {
  const contentDigest = digestContent(VERSION_CONTENT);
  const provisional = sealFact<MaterialRecord>({
    schemaVersion: 1,
    id: materialIdSchema.parse(`mat_${ZERO_64}`),
    subjectId: SUBJECT_ID,
    kind: "web",
    contentDigest,
    provenanceDigest: provenanceDigestSchema.parse(`provenance_sha256_${ZERO_64}`),
    sourceIdentity: "source-uri-v1\0https://example.com/version-evidence",
    source: {
      uri: "https://example.com/version-evidence",
      medium: "article",
      access: "public",
      capturedAt: AT,
      authors: [],
    },
    derivation: { kind: "native_text" },
    participants: [],
    sensitivity: "private",
    flags: [],
    storedAt: AT,
  });
  const provenanceDigest = digestMaterialProvenance(provisional);
  return sealFact<MaterialRecord>({
    ...provisional,
    provenanceDigest,
    id: deriveMaterialId(provisional.sourceIdentity, provenanceDigest, contentDigest),
  });
};

const entryFor = (record: MaterialRecord): VersionMaterialEntry => ({
  materialId: record.id,
  contentDigest: record.contentDigest,
  provenanceDigest: record.provenanceDigest,
});

const summary = (id = SUBJECT_ID, spaceId = SPACE_ID): SubjectSummary => ({
  id,
  displayName: id === SUBJECT_ID ? "Ada" : "Grace",
  aliases: [],
  identityHints: [],
  space: { id: spaceId, displayName: "People", kind: "people" },
  lifecycle: "active",
});

const makeCreateOperation = (
  requestId = REQUEST_ID,
  subjectId = SUBJECT_ID,
): OperationRecord<"subjects.create"> =>
  sealFact<OperationRecord<"subjects.create">>({
    schemaVersion: 1,
    recordKind: "completed",
    requestId,
    method: "subjects.create",
    scope: { kind: "subject", subjectId },
    actor: { kind: "sdk", id: "step5-store-test" },
    inputChecksum: computeFactChecksum({ method: "subjects.create", subjectId }),
    result: summary(subjectId),
    completedAt: AT,
  });

const makeIngestOperation = (
  requestId: typeof REQUEST_ID,
  subjectId = SUBJECT_ID,
): OperationRecord<"materials.ingest"> =>
  sealFact<OperationRecord<"materials.ingest">>({
    schemaVersion: 1,
    recordKind: "completed",
    requestId,
    method: "materials.ingest",
    scope: { kind: "subject", subjectId },
    actor: { kind: "sdk", id: "step5-store-test" },
    inputChecksum: computeFactChecksum({ method: "materials.ingest", subjectId }),
    result: {
      kind: "unchanged",
      subject: summary(subjectId),
      items: [
        {
          clientRef: "duplicate-1",
          kind: "duplicate",
          materialId: `mat_${ZERO_64}` as VersionMaterialEntry["materialId"],
          contentDigest: `sha256_${ZERO_64}` as VersionMaterialEntry["contentDigest"],
        },
      ],
      materialSetHash: SET_HASH,
      generation: 1,
    },
    completedAt: AT,
  });

const makeTransaction = (
  requestId: typeof REQUEST_ID,
  state: "prepared" | "committed" | "aborted" = "prepared",
): IngestTransactionRecord => {
  const base = {
    schemaVersion: 1 as const,
    transactionKind: "ingest" as const,
    requestId,
    spaceId: SPACE_ID,
    subjectId: SUBJECT_ID,
    createdSubject: false as const,
    previousStateChecksum: OTHER_CHECKSUM,
    targetStateChecksum: computeFactChecksum({ state: "target", requestId }),
    newMaterials: [],
    operation: makeIngestOperation(requestId),
    events: [],
    preparedAt: AT,
  };
  const payload = state === "prepared" ? { ...base, state } : { ...base, state, finishedAt: LATER };
  return { ...payload, checksum: computeFactChecksum(payload) };
};

const VERSION_ENTRY: VersionMaterialEntry = {
  materialId: `mat_${ZERO_64}` as VersionMaterialEntry["materialId"],
  contentDigest: `sha256_${ZERO_64}` as VersionMaterialEntry["contentDigest"],
  provenanceDigest: `provenance_sha256_${ZERO_64}` as VersionMaterialEntry["provenanceDigest"],
};

const QUALITY = {
  sourceGroupingVersion: "source-groups-v1",
  activeClaimCount: 0,
  contestedClaimCount: 0,
  userAssertedClaimCount: 0,
  corroboratedClaimCount: 0,
  sourceGroupCount: 1,
  diversityEligibleSourceGroupCount: 1,
  unknownSourceGroupCount: 0,
  coveredCoreFacets: ["identity"],
  uncoveredCoreFacets: ["voice", "psyche", "relations", "boundaries", "texture", "timeline"],
  maturity: "forming",
} as const;

const makeVersion = (
  id = VERSION_ID,
  subjectId = SUBJECT_ID,
  items: readonly VersionMaterialEntry[] = [VERSION_ENTRY],
): { readonly version: VersionRecord; readonly manifest: VersionMaterialManifest } => {
  const materialSetHash = hashMaterialSet(items);
  return {
    version: sealFact<VersionRecord>({
      schemaVersion: 1,
      id,
      subjectId,
      generation: 1,
      materialSetHash,
      materialCount: items.length,
      creation: { kind: "renderer_only", sourceVersionId: id },
      createdDisposition: "current",
      actor: { kind: "system", id: "step5-store-test" },
      quality: QUALITY,
      rendererVersion: "renderer-v1",
      createdAt: AT,
    }),
    manifest: sealFact<VersionMaterialManifest>({ schemaVersion: 1, items }),
  };
};

describe("Step 5 root fact stores", () => {
  it("creates spaces immutably and safely lists spaces and subjects", async () => {
    const root = await createRoot();
    const layout = new Layout(root);
    const spaces = new FileSpaceStore(layout);
    const subjects = new FileSubjectStore(layout, spaces);

    await spaces.write(makeSpace(OTHER_SPACE_ID, "Other"));
    await spaces.write(makeSpace());
    await spaces.write(makeSpace());
    await expectCode(spaces.write(makeSpace(SPACE_ID, "Changed")), "storage_corrupt");
    await mkdir(layout.spaceCatalogLock(), { mode: 0o700 });
    await mkdir(layout.spaceIdentityLock(SPACE_ID), { mode: 0o700 });
    await writeFile(
      join(layout.spacesDirectory(), `.${SPACE_ID}.json.${process.pid}.${"a".repeat(16)}.tmp`),
      "partial",
    );
    expect((await spaces.list()).map((record) => record.id)).toEqual([SPACE_ID, OTHER_SPACE_ID]);

    await subjects.write(makeSubject(OTHER_SUBJECT_ID, OTHER_SPACE_ID, "Grace"));
    await subjects.write(makeSubject());
    expect((await subjects.listBySpace(SPACE_ID)).map((record) => record.id)).toEqual([SUBJECT_ID]);
    expect((await subjects.listAll()).map((record) => record.id)).toEqual([
      SUBJECT_ID,
      OTHER_SUBJECT_ID,
    ]);

    await writeFile(join(layout.spacesDirectory(), "unknown.txt"), "unknown");
    await expectCode(spaces.list(), "storage_corrupt");
    await rm(join(layout.spacesDirectory(), "unknown.txt"));
    if (process.platform === "linux") {
      const invalidName = Buffer.concat([
        Buffer.from(`${layout.spacesDirectory()}/`, "utf8"),
        Buffer.from([0xff]),
      ]);
      await writeFile(invalidName, "invalid");
      await expectCode(spaces.list(), "storage_corrupt");
      await rm(invalidName);
    }
    const partialSubject = join(
      layout.subjectsDirectory(),
      "subject_22222222222222222222222222222222",
    );
    await mkdir(partialSubject, { mode: 0o700 });
    await expectCode(subjects.listAll(), "storage_corrupt");
    await rm(partialSubject, { recursive: true });
    await symlink(root, partialSubject);
    await expectCode(subjects.listBySpace(SPACE_ID), "storage_corrupt");
  });

  it("enforces the reserved people record and recognizes exact file-lock artifacts", async () => {
    const root = await createRoot();
    const layout = new Layout(root);
    const spaces = new FileSpaceStore(layout);
    const builtin = makeSpace(BUILTIN_PEOPLE_SPACE_ID);
    await spaces.write(builtin);
    await spaces.write(builtin);
    await expect(spaces.read(BUILTIN_PEOPLE_SPACE_ID)).resolves.toEqual(builtin);
    await expectCode(spaces.write(makeSpace(BUILTIN_PEOPLE_SPACE_ID, "people")), "storage_corrupt");

    const wrongKind = sealFact<SpaceRecord>({ ...builtin, kind: "custom" });
    await rm(layout.spaceFile(BUILTIN_PEOPLE_SPACE_ID));
    await createFactFile(
      root,
      layout.spaceFile(BUILTIN_PEOPLE_SPACE_ID),
      wrongKind,
      spaceRecordSchema,
    );
    await expectCode(spaces.read(BUILTIN_PEOPLE_SPACE_ID), "storage_corrupt");
    await rm(layout.spaceFile(BUILTIN_PEOPLE_SPACE_ID));

    const token = "a".repeat(32);
    const temporary = "b".repeat(16);
    const pid = process.pid;
    const artifacts = [
      `${SPACE_ID}.identity.lock`,
      `${SPACE_ID}.identity.lock.transition`,
      `${SPACE_ID}.identity.lock.fence.1-2-${token}`,
      `${SPACE_ID}.identity.lock.transition.fence.1-2-${token}`,
      `${SPACE_ID}.identity.lock.retired.${token}`,
      `${SPACE_ID}.identity.lock.transition.retired.${token}`,
      `.${SPACE_ID}.identity.lock.${pid}.${temporary}.tmp`,
      `.${SPACE_ID}.identity.lock.transition.${pid}.${temporary}.tmp`,
      ".catalog.lock",
      ".catalog.lock.transition",
      `.catalog.lock.fence.1-2-${token}`,
      `.catalog.lock.transition.retired.${token}`,
      `..catalog.lock.${pid}.${temporary}.tmp`,
      `..catalog.lock.transition.${pid}.${temporary}.tmp`,
    ];
    for (const artifact of artifacts) {
      await mkdir(join(layout.spacesDirectory(), artifact), { recursive: true, mode: 0o700 });
    }
    await expect(spaces.list()).resolves.toEqual([]);

    const nearMiss = `${SPACE_ID}.identity.lock.fence.1-2-${temporary}`;
    await mkdir(join(layout.spacesDirectory(), nearMiss), { mode: 0o700 });
    await expectCode(spaces.list(), "storage_corrupt");
  });

  it("stores completed operations at the root, validates scope, and reads tombstones", async () => {
    const root = await createRoot();
    const layout = new Layout(root);
    const spaces = new FileSpaceStore(layout);
    const subjects = new FileSubjectStore(layout, spaces);
    const operations = new FileOperationStore(layout, subjects);
    await spaces.write(makeSpace());
    await subjects.write(makeSubject());

    const operation = makeCreateOperation();
    await operations.write(operation);
    await operations.write(operation);
    await expect(operations.read(REQUEST_ID)).resolves.toEqual(operation);
    await expect(operations.readOptional(THIRD_REQUEST_ID)).resolves.toBeUndefined();
    const badScope = sealFact<OperationRecord<"subjects.create">>({
      ...operation,
      scope: { kind: "global" },
    });
    await expectCode(operations.write(badScope), "storage_corrupt");

    const globalOperation = sealFact<OperationRecord<"library.rebuild">>({
      schemaVersion: 1,
      recordKind: "completed",
      requestId: THIRD_REQUEST_ID,
      method: "library.rebuild",
      scope: { kind: "global" },
      actor: { kind: "system", id: "step5-store-test" },
      inputChecksum: computeFactChecksum({ method: "library.rebuild" }),
      result: { subjects: 1, jobs: 0, relations: 0, rebuiltAt: AT },
      completedAt: AT,
    });
    await operations.write(globalOperation);
    await expect(operations.read(THIRD_REQUEST_ID)).resolves.toEqual(globalOperation);

    const tombstone = sealFact<OperationTombstoneRecord>({
      schemaVersion: 1,
      recordKind: "tombstone",
      requestId: OTHER_REQUEST_ID,
      method: "subjects.purge",
      scope: { kind: "subject", subjectId: SUBJECT_ID },
      inputChecksum: operation.inputChecksum,
      removedAt: LATER,
      reason: "subject_purged",
    });
    await createFactFile<OperationFact>(
      root,
      layout.operationFile(OTHER_REQUEST_ID),
      tombstone,
      OPERATION_FACT_SCHEMA,
    );
    await expect(operations.read(OTHER_REQUEST_ID)).resolves.toEqual(tombstone);
    await rm(layout.subjectDirectory(SUBJECT_ID), { recursive: true });
    await expect(operations.read(OTHER_REQUEST_ID)).resolves.toEqual(tombstone);
  });

  it("replaces and lists verified root transactions in RequestId order", async () => {
    const root = await createRoot();
    const layout = new Layout(root);
    const transactions = new FileTransactionStore(layout);
    const later = makeTransaction(OTHER_REQUEST_ID);
    const first = makeTransaction(REQUEST_ID);
    await transactions.write(later);
    await transactions.write(first);
    await expect(transactions.readOptional(THIRD_REQUEST_ID)).resolves.toBeUndefined();
    expect((await transactions.list()).map((record) => record.requestId)).toEqual([
      REQUEST_ID,
      OTHER_REQUEST_ID,
    ]);

    const committed = makeTransaction(REQUEST_ID, "committed");
    if (committed.state !== "committed") throw new Error("Expected a committed transaction.");
    await transactions.write(committed);
    await expect(transactions.read(REQUEST_ID)).resolves.toEqual(committed);
    await transactions.write(committed);
    await expectCode(transactions.write({ ...committed, finishedAt: AT }), "storage_corrupt");
    await expect(transactions.read(REQUEST_ID)).resolves.toEqual(committed);
    await expectCode(transactions.write(first), "storage_corrupt");
    await expectCode(
      transactions.write(makeTransaction(THIRD_REQUEST_ID, "committed")),
      "storage_corrupt",
    );
    const changedCommittedPayload = { ...committed, finishedAt: AT };
    await expectCode(
      transactions.write({
        ...changedCommittedPayload,
        checksum: computeFactChecksum(changedCommittedPayload),
      }),
      "storage_corrupt",
    );

    const aborted = makeTransaction(OTHER_REQUEST_ID, "aborted");
    await transactions.write(aborted);
    await transactions.write(later);
    await transactions.write(aborted);
    const changedOperation = sealFact<OperationRecord<"materials.ingest">>({
      ...later.operation,
      inputChecksum: OTHER_CHECKSUM,
    });
    const changedPreparedPayload = { ...later, operation: changedOperation };
    await expectCode(
      transactions.write({
        ...changedPreparedPayload,
        checksum: computeFactChecksum(changedPreparedPayload),
      }),
      "storage_corrupt",
    );

    await replaceFactFile(
      root,
      layout.transactionFile(REQUEST_ID),
      makeTransaction(OTHER_REQUEST_ID),
      TRANSACTION_SCHEMA,
    );
    await expectCode(transactions.read(REQUEST_ID), "storage_corrupt");
    await replaceFactFile(root, layout.transactionFile(REQUEST_ID), committed, TRANSACTION_SCHEMA);
    await writeFile(
      layout.transactionFile(REQUEST_ID),
      `${JSON.stringify({ ...committed, state: "aborted" })}\n`,
    );
    await expectCode(transactions.read(REQUEST_ID), "storage_corrupt");
    await replaceFactFile(root, layout.transactionFile(REQUEST_ID), committed, TRANSACTION_SCHEMA);
    await writeFile(
      join(
        layout.transactionsDirectory(),
        `.${THIRD_REQUEST_ID}.json.${process.pid}.${"a".repeat(16)}.tmp`,
      ),
      "partial",
    );
    expect((await transactions.list()).map((record) => record.requestId)).toEqual([
      REQUEST_ID,
      OTHER_REQUEST_ID,
    ]);
    await writeFile(join(layout.transactionsDirectory(), "unknown.json"), "{}\n");
    await expectCode(transactions.list(), "storage_corrupt");
    await rm(join(layout.transactionsDirectory(), "unknown.json"));
    await symlink(root, join(layout.transactionsDirectory(), `${THIRD_REQUEST_ID}.json`));
    await expectCode(transactions.list(), "storage_corrupt");
  });

  it("keeps a prepared transaction unchanged when a terminal payload is mutated", async () => {
    const root = await createRoot();
    const transactions = new FileTransactionStore(new Layout(root));
    const prepared = makeTransaction(REQUEST_ID);
    if (prepared.createdSubject) throw new Error("Expected an existing-subject fixture.");
    await transactions.write(prepared);
    const changedOperation = sealFact<OperationRecord<"materials.ingest">>({
      ...prepared.operation,
      inputChecksum: OTHER_CHECKSUM,
    });

    for (const state of ["committed", "aborted"] as const) {
      const payload = {
        schemaVersion: 1,
        transactionKind: "ingest",
        requestId: prepared.requestId,
        spaceId: prepared.spaceId,
        subjectId: prepared.subjectId,
        createdSubject: false,
        previousStateChecksum: prepared.previousStateChecksum,
        targetStateChecksum: prepared.targetStateChecksum,
        newMaterials: prepared.newMaterials,
        operation: changedOperation,
        events: prepared.events,
        preparedAt: prepared.preparedAt,
        state,
        finishedAt: LATER,
      } as const;
      await expectCode(
        transactions.write(
          TRANSACTION_SCHEMA.parse({ ...payload, checksum: computeFactChecksum(payload) }),
        ),
        "storage_corrupt",
      );
      await expect(transactions.read(REQUEST_ID)).resolves.toEqual(prepared);
    }
  });

  it("validates the immutable current-version baseline record and manifest", async () => {
    const root = await createRoot();
    const layout = new Layout(root);
    const spaces = new FileSpaceStore(layout);
    const subjects = new FileSubjectStore(layout, spaces);
    const materials = new FileMaterialStore(layout, subjects);
    const versions = new FileVersionManifestStore(layout, materials);
    await spaces.write(makeSpace());
    await subjects.write(makeSubject());
    const material = makeMaterial();
    await materials.write(material, VERSION_CONTENT);
    const valid = makeVersion(VERSION_ID, SUBJECT_ID, [entryFor(material)]);
    await createFactFile(
      root,
      layout.versionFile(SUBJECT_ID, VERSION_ID),
      valid.version,
      VERSION_SCHEMA,
    );
    await createFactFile(
      root,
      layout.versionMaterialManifestFile(SUBJECT_ID, VERSION_ID),
      valid.manifest,
      VERSION_MANIFEST_SCHEMA,
    );
    await expect(versions.read(SUBJECT_ID, VERSION_ID)).resolves.toEqual(valid);

    const wrongCount = sealFact<VersionRecord>({ ...valid.version, materialCount: 0 });
    await replaceFactFile(
      root,
      layout.versionFile(SUBJECT_ID, VERSION_ID),
      wrongCount,
      VERSION_SCHEMA,
    );
    await expectCode(versions.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");

    const wrongHash = sealFact<VersionRecord>({ ...valid.version, materialSetHash: SET_HASH });
    await replaceFactFile(
      root,
      layout.versionFile(SUBJECT_ID, VERSION_ID),
      wrongHash,
      VERSION_SCHEMA,
    );
    await expectCode(versions.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");

    const wrongSubject = sealFact<VersionRecord>({
      ...valid.version,
      subjectId: OTHER_SUBJECT_ID,
    });
    await replaceFactFile(
      root,
      layout.versionFile(SUBJECT_ID, VERSION_ID),
      wrongSubject,
      VERSION_SCHEMA,
    );
    await expectCode(versions.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");
    await replaceFactFile(
      root,
      layout.versionFile(SUBJECT_ID, VERSION_ID),
      valid.version,
      VERSION_SCHEMA,
    );
    await rm(layout.versionMaterialManifestFile(SUBJECT_ID, VERSION_ID));
    await expectCode(versions.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");

    for (const mismatch of [
      { ...entryFor(material), contentDigest: VERSION_ENTRY.contentDigest },
      { ...entryFor(material), provenanceDigest: VERSION_ENTRY.provenanceDigest },
    ]) {
      const mismatched = makeVersion(VERSION_ID, SUBJECT_ID, [mismatch]);
      await replaceFactFile(
        root,
        layout.versionFile(SUBJECT_ID, VERSION_ID),
        mismatched.version,
        VERSION_SCHEMA,
      );
      await replaceFactFile(
        root,
        layout.versionMaterialManifestFile(SUBJECT_ID, VERSION_ID),
        mismatched.manifest,
        VERSION_MANIFEST_SCHEMA,
      );
      await expectCode(versions.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");
    }

    await replaceFactFile(
      root,
      layout.versionFile(SUBJECT_ID, VERSION_ID),
      valid.version,
      VERSION_SCHEMA,
    );
    await replaceFactFile(
      root,
      layout.versionMaterialManifestFile(SUBJECT_ID, VERSION_ID),
      valid.manifest,
      VERSION_MANIFEST_SCHEMA,
    );
    await rm(layout.materialDirectory(SUBJECT_ID, material.id), { recursive: true });
    await expectCode(versions.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");

    const other = makeVersion(OTHER_VERSION_ID);
    const wrongPathId = sealFact<VersionRecord>({ ...other.version, id: VERSION_ID });
    await createFactFile(
      root,
      layout.versionFile(SUBJECT_ID, OTHER_VERSION_ID),
      wrongPathId,
      VERSION_SCHEMA,
    );
    await expectCode(versions.read(SUBJECT_ID, OTHER_VERSION_ID), "storage_corrupt");
  });
});
