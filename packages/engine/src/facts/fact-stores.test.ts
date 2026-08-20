import {
  DistillyError,
  contentDigestSchema,
  eventIdSchema,
  isoDateTimeSchema,
  materialIdSchema,
  materialSetHashSchema,
  provenanceDigestSchema,
  requestIdSchema,
  spaceIdSchema,
  subjectIdSchema,
} from "@distilly/protocol";
import type {
  DistillyErrorCode,
  EventRecord,
  FactEnvelope,
  MaterialRecord,
  OperationRecord,
  SpaceRecord,
  SubjectId,
  SubjectRecord,
  SubjectStateRecord,
  SubjectSummary,
  VersionMaterialEntry,
} from "@distilly/protocol";
import { mkdir, readFile, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { afterEach, describe, expect, it } from "vitest";

import { Layout } from "../layout.js";
import { computeFactChecksum, sealFact } from "./checksum.js";
import {
  deriveMaterialId,
  digestContent,
  digestMaterialProvenance,
  hashMaterialSet,
} from "./digests.js";
import { FileEventStore } from "./event-store.js";
import { FileMaterialStore } from "./material-store.js";
import { FileOperationStore } from "./operation-store.js";
import { FileSpaceStore } from "./space-store.js";
import { FileStateStore } from "./state-store.js";
import { FileSubjectStore } from "./subject-store.js";

const HEX_32 = "0".repeat(32);
const ALT_HEX_32 = "1".repeat(32);
const HEX_64 = "0".repeat(64);
const ALT_HEX_64 = "1".repeat(64);

const SPACE_ID = spaceIdSchema.parse(`space_${HEX_32}`);
const OTHER_SPACE_ID = spaceIdSchema.parse(`space_${ALT_HEX_32}`);
const SUBJECT_ID = subjectIdSchema.parse(`subject_${HEX_32}`);
const OTHER_SUBJECT_ID = subjectIdSchema.parse(`subject_${ALT_HEX_32}`);
const EVENT_ID = eventIdSchema.parse(`event_${HEX_32}`);
const OTHER_EVENT_ID = eventIdSchema.parse(`event_${ALT_HEX_32}`);
const REQUEST_ID = requestIdSchema.parse(`req_${HEX_32}`);
const OTHER_REQUEST_ID = requestIdSchema.parse(`req_${ALT_HEX_32}`);
const AT = isoDateTimeSchema.parse("2026-08-20T00:00:00.000Z");
const LATER = isoDateTimeSchema.parse("2026-08-20T00:01:00.000Z");
const CANONICAL_SPACE_BYTES = `{"checksum":"fact_sha256_fe51be64a2d3df70e654c6be7d3d0ae762cf295676c97c476406d9eb3d921c06","displayName":"People","id":"space_${HEX_32}","kind":"people","schemaVersion":1}\n`;

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => rm(root, { recursive: true, force: true })),
  );
});

type Harness = {
  readonly root: string;
  readonly layout: Layout;
  readonly spaces: FileSpaceStore;
  readonly subjects: FileSubjectStore;
  readonly materials: FileMaterialStore;
  readonly states: FileStateStore;
  readonly events: FileEventStore;
  readonly operations: FileOperationStore;
};

const createHarness = async (): Promise<Harness> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-fact-stores-"));
  roots.push(root);
  const layout = new Layout(root);
  const spaces = new FileSpaceStore(layout);
  const subjects = new FileSubjectStore(layout, spaces);
  const materials = new FileMaterialStore(layout, subjects);
  return {
    root,
    layout,
    spaces,
    subjects,
    materials,
    states: new FileStateStore(layout, subjects, materials),
    events: new FileEventStore(layout, subjects),
    operations: new FileOperationStore(layout, subjects),
  };
};

const expectErrorCode = async (
  promise: Promise<unknown>,
  code: DistillyErrorCode,
): Promise<void> => {
  try {
    await promise;
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(DistillyError);
    expect(error).toMatchObject({ code });
  }
};

const omitChecksum = <T extends FactEnvelope>(record: T): Omit<T, "checksum"> => {
  const { checksum, ...payload } = record;
  void checksum;
  return payload;
};

const resealFact = <T extends FactEnvelope>(
  record: T,
  overrides: Partial<Omit<T, "checksum">>,
): T => sealFact<T>({ ...omitChecksum(record), ...overrides });

const writeJson = async (path: string, value: unknown): Promise<void> => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value)}\n`, { mode: 0o600 });
};

const makeSpace = (
  id = SPACE_ID,
  displayName = "People",
  kind: SpaceRecord["kind"] = "people",
): SpaceRecord =>
  sealFact<SpaceRecord>({
    schemaVersion: 1,
    id,
    displayName,
    kind,
  });

const makeSubject = (id = SUBJECT_ID, spaceId = SPACE_ID, displayName = "Ada"): SubjectRecord =>
  sealFact<SubjectRecord>({
    schemaVersion: 1,
    id,
    spaceId,
    displayName,
    aliases: ["A"],
    identityHints: [{ kind: "url", value: "https://example.com/ada" }],
    lifecycle: "active",
  });

const makeSubjectSummary = (
  subjectId = SUBJECT_ID,
  spaceId = SPACE_ID,
  displayName = "Ada",
): SubjectSummary => ({
  id: subjectId,
  displayName,
  aliases: ["A"],
  identityHints: [{ kind: "url", value: "https://example.com/ada" }],
  space: { id: spaceId, displayName: "People", kind: "people" },
  lifecycle: "active",
});

const makeMaterial = (
  content = "Evidence-bound material.\n",
  input: {
    readonly subjectId?: SubjectId;
    readonly sourceIdentity?: string;
    readonly uri?: string;
    readonly title?: string;
    readonly capturedAt?: string;
    readonly sensitivity?: "private" | "shareable";
  } = {},
): MaterialRecord => {
  const subjectId = input.subjectId ?? SUBJECT_ID;
  const contentDigest = digestContent(content);
  const provisional = sealFact<MaterialRecord>({
    schemaVersion: 1,
    id: materialIdSchema.parse(`mat_${HEX_64}`),
    subjectId,
    kind: "web",
    contentDigest,
    provenanceDigest: provenanceDigestSchema.parse(`provenance_sha256_${HEX_64}`),
    sourceIdentity: input.sourceIdentity ?? "uri:https://example.com/post",
    source: {
      uri: input.uri ?? "https://example.com/post",
      title: input.title ?? "Post",
      medium: "article",
      access: "public",
      role: "first_party_expression",
      capturedAt: isoDateTimeSchema.parse(input.capturedAt ?? AT),
      publishedAt: AT,
      authors: ["Ada"],
    },
    derivation: { kind: "native_text" },
    participants: [],
    sensitivity: input.sensitivity ?? "private",
    flags: [],
    storedAt: AT,
  });
  const provenanceDigest = digestMaterialProvenance(provisional);
  return resealFact(provisional, {
    provenanceDigest,
    id: deriveMaterialId(provisional.sourceIdentity, provenanceDigest, contentDigest),
  });
};

const materialEntry = (record: MaterialRecord): VersionMaterialEntry => ({
  materialId: record.id,
  contentDigest: record.contentDigest,
  provenanceDigest: record.provenanceDigest,
});

const makeState = (
  subjectId = SUBJECT_ID,
  entries: readonly VersionMaterialEntry[] = [],
): SubjectStateRecord =>
  entries.length === 0
    ? sealFact<SubjectStateRecord>({
        schemaVersion: 1,
        subjectId,
        generation: 0,
        materialManifest: [],
      })
    : sealFact<SubjectStateRecord>({
        schemaVersion: 1,
        subjectId,
        generation: 1,
        materialSetHash: hashMaterialSet(entries),
        materialManifest: entries,
      });

const makeEvent = (eventId = EVENT_ID, subjectId = SUBJECT_ID, at = AT): EventRecord =>
  sealFact<EventRecord>({
    schemaVersion: 1,
    eventId,
    event: { kind: "material.ingested", subjectId, at },
    actor: { kind: "sdk", id: "fact-store-test" },
    requestId: REQUEST_ID,
  });

const makeOperation = (
  requestId = REQUEST_ID,
  resultSubjectId = SUBJECT_ID,
  completedAt = AT,
): OperationRecord<"subjects.create"> =>
  sealFact<OperationRecord<"subjects.create">>({
    schemaVersion: 1,
    requestId,
    method: "subjects.create",
    actor: { kind: "sdk", id: "fact-store-test" },
    inputChecksum: computeFactChecksum({ method: "subjects.create", displayName: "Ada" }),
    result: makeSubjectSummary(resultSubjectId),
    completedAt,
  });

const seedSubject = async (harness: Harness): Promise<void> => {
  await harness.spaces.write(makeSpace());
  await harness.subjects.write(makeSubject());
};

const seedAllStores = async (harness: Harness) => {
  await seedSubject(harness);
  const content = "Evidence-bound material.\n";
  const material = makeMaterial(content);
  const state = makeState(SUBJECT_ID, [materialEntry(material)]);
  const event = makeEvent();
  const operation = makeOperation();
  await harness.materials.write(material, content);
  await harness.states.write(state);
  await harness.events.write(SUBJECT_ID, event);
  await harness.operations.write(SUBJECT_ID, operation);
  return { content, material, state, event, operation };
};

describe("concrete fact stores", () => {
  it("round-trips every fact family and accepts exact immutable retries", async () => {
    const harness = await createHarness();
    const { content, material, state, event, operation } = await seedAllStores(harness);

    await harness.materials.write(material, content);
    await harness.events.write(SUBJECT_ID, event);
    await harness.operations.write(SUBJECT_ID, operation);

    expect(await harness.spaces.read(SPACE_ID)).toEqual(makeSpace());
    expect(await harness.subjects.read(SUBJECT_ID)).toEqual(makeSubject());
    expect(await harness.materials.read(SUBJECT_ID, material.id)).toEqual({
      record: material,
      content,
    });
    expect(await harness.states.read(SUBJECT_ID)).toEqual(state);
    expect(await harness.events.read(SUBJECT_ID, EVENT_ID)).toEqual(event);
    expect(await harness.operations.read(SUBJECT_ID, REQUEST_ID)).toEqual(operation);

    const renamedSpace = makeSpace(SPACE_ID, "People and Creators");
    const renamedSubject = makeSubject(SUBJECT_ID, SPACE_ID, "Ada Lovelace");
    await harness.spaces.write(renamedSpace);
    await harness.subjects.write(renamedSubject);
    expect(await harness.spaces.read(SPACE_ID)).toEqual(renamedSpace);
    expect(await harness.subjects.read(SUBJECT_ID)).toEqual(renamedSubject);
  });

  it("rejects unsupported schemas, checksum corruption, and path-id mismatches", async () => {
    const harness = await createHarness();
    const record = makeSpace();
    await harness.spaces.write(record);

    await writeJson(harness.layout.spaceFile(SPACE_ID), { ...record, schemaVersion: 2 });
    await expectErrorCode(harness.spaces.read(SPACE_ID), "schema_unsupported");

    for (const schemaVersion of [undefined, "1", null, {}, [], 0, -1, 1.5]) {
      await writeJson(harness.layout.spaceFile(SPACE_ID), { ...record, schemaVersion });
      await expectErrorCode(harness.spaces.read(SPACE_ID), "storage_corrupt");
    }

    await writeJson(harness.layout.spaceFile(SPACE_ID), { ...record, displayName: "Tampered" });
    await expectErrorCode(harness.spaces.read(SPACE_ID), "storage_corrupt");

    await writeJson(harness.layout.spaceFile(SPACE_ID), makeSpace(OTHER_SPACE_ID));
    await expectErrorCode(harness.spaces.read(SPACE_ID), "storage_corrupt");
  });

  it("requires every subject to reference an existing space and match its path", async () => {
    const harness = await createHarness();
    await expectErrorCode(harness.subjects.write(makeSubject()), "storage_corrupt");

    await harness.spaces.write(makeSpace());
    await harness.subjects.write(makeSubject());
    await writeJson(harness.layout.subjectFile(SUBJECT_ID), makeSubject(OTHER_SUBJECT_ID));
    await expectErrorCode(harness.subjects.read(SUBJECT_ID), "storage_corrupt");

    await writeJson(
      harness.layout.subjectFile(SUBJECT_ID),
      makeSubject(SUBJECT_ID, OTHER_SPACE_ID),
    );
    await expectErrorCode(harness.subjects.read(SUBJECT_ID), "storage_corrupt");
  });

  it("validates immutable material content, provenance, identity, path, and conflicts", async () => {
    const harness = await createHarness();
    await seedSubject(harness);
    const content = "Evidence-bound material.\n";
    const material = makeMaterial(content);
    await harness.materials.write(material, content);

    await writeFile(harness.layout.materialContentFile(SUBJECT_ID, material.id), "tampered\n");
    await expectErrorCode(harness.materials.read(SUBJECT_ID, material.id), "storage_corrupt");

    await writeFile(
      harness.layout.materialContentFile(SUBJECT_ID, material.id),
      Buffer.from([0xc3, 0x28]),
    );
    await expectErrorCode(harness.materials.read(SUBJECT_ID, material.id), "storage_corrupt");

    await rm(harness.layout.materialDirectory(SUBJECT_ID, material.id), {
      recursive: true,
      force: true,
    });
    await harness.materials.write(material, content);
    const provenanceMismatch = resealFact(material, { sensitivity: "shareable" });
    await writeJson(harness.layout.materialFile(SUBJECT_ID, material.id), provenanceMismatch);
    await expectErrorCode(harness.materials.read(SUBJECT_ID, material.id), "storage_corrupt");

    await rm(harness.layout.materialDirectory(SUBJECT_ID, material.id), {
      recursive: true,
      force: true,
    });
    const wrongId = resealFact(material, {
      id: materialIdSchema.parse(`mat_${ALT_HEX_64}`),
    });
    await expectErrorCode(harness.materials.write(wrongId, content), "storage_corrupt");

    await harness.materials.write(material, content);
    const movedId = materialIdSchema.parse(`mat_${ALT_HEX_64}`);
    await rename(
      harness.layout.materialDirectory(SUBJECT_ID, material.id),
      harness.layout.materialDirectory(SUBJECT_ID, movedId),
    );
    await expectErrorCode(harness.materials.read(SUBJECT_ID, movedId), "storage_corrupt");

    await rename(
      harness.layout.materialDirectory(SUBJECT_ID, movedId),
      harness.layout.materialDirectory(SUBJECT_ID, material.id),
    );
    const conflictingObservation = makeMaterial(content, {
      title: "A later display title",
      capturedAt: LATER,
    });
    expect(conflictingObservation.id).toBe(material.id);
    expect(conflictingObservation.provenanceDigest).toBe(material.provenanceDigest);
    await expectErrorCode(
      harness.materials.write(conflictingObservation, content),
      "storage_corrupt",
    );
    expect(await harness.materials.read(SUBJECT_ID, material.id)).toEqual({
      record: material,
      content,
    });

    const mirror = makeMaterial(content, {
      sourceIdentity: "uri:https://mirror.example/post",
      uri: "https://mirror.example/post",
    });
    expect(mirror.provenanceDigest).toBe(material.provenanceDigest);
    expect(mirror.id).not.toBe(material.id);

    const shareable = makeMaterial(content, { sensitivity: "shareable" });
    expect(shareable.provenanceDigest).not.toBe(material.provenanceDigest);
    expect(shareable.id).not.toBe(material.id);
  });

  it("validates state subject ownership, manifest facts, digests, and set hash", async () => {
    const harness = await createHarness();
    await seedSubject(harness);
    const content = "Evidence-bound material.\n";
    const material = makeMaterial(content);
    const entry = materialEntry(material);
    await harness.materials.write(material, content);

    const valid = makeState(SUBJECT_ID, [entry]);
    await harness.states.write(valid);
    expect(await harness.states.read(SUBJECT_ID)).toEqual(valid);

    const missingEntry: VersionMaterialEntry = {
      ...entry,
      materialId: materialIdSchema.parse(`mat_${ALT_HEX_64}`),
    };
    await expectErrorCode(
      harness.states.write(makeState(SUBJECT_ID, [missingEntry])),
      "storage_corrupt",
    );

    const wrongContentEntry: VersionMaterialEntry = {
      ...entry,
      contentDigest: contentDigestSchema.parse(`sha256_${ALT_HEX_64}`),
    };
    await expectErrorCode(
      harness.states.write(makeState(SUBJECT_ID, [wrongContentEntry])),
      "storage_corrupt",
    );

    const wrongProvenanceEntry: VersionMaterialEntry = {
      ...entry,
      provenanceDigest: provenanceDigestSchema.parse(`provenance_sha256_${ALT_HEX_64}`),
    };
    await expectErrorCode(
      harness.states.write(makeState(SUBJECT_ID, [wrongProvenanceEntry])),
      "storage_corrupt",
    );

    const wrongHash = resealFact(valid, {
      materialSetHash: materialSetHashSchema.parse(`set_sha256_${ALT_HEX_64}`),
    });
    await expectErrorCode(harness.states.write(wrongHash), "storage_corrupt");

    await writeJson(harness.layout.stateFile(SUBJECT_ID), makeState(OTHER_SUBJECT_ID));
    await expectErrorCode(harness.states.read(SUBJECT_ID), "storage_corrupt");
    await expectErrorCode(harness.states.write(makeState(OTHER_SUBJECT_ID)), "storage_corrupt");
  });

  it("rejects unsorted and duplicate material manifests at the state-store boundary", async () => {
    const harness = await createHarness();
    await seedSubject(harness);
    const firstContent = "First manifest material.\n";
    const secondContent = "Second manifest material.\n";
    const first = makeMaterial(firstContent, {
      sourceIdentity: "uri:https://example.com/first",
      uri: "https://example.com/first",
    });
    const second = makeMaterial(secondContent, {
      sourceIdentity: "uri:https://example.com/second",
      uri: "https://example.com/second",
    });
    await harness.materials.write(first, firstContent);
    await harness.materials.write(second, secondContent);

    const entries = [materialEntry(first), materialEntry(second)].sort((left, right) =>
      left.materialId < right.materialId ? -1 : left.materialId > right.materialId ? 1 : 0,
    );
    const valid = makeState(SUBJECT_ID, entries);
    await harness.states.write(valid);
    await expect(harness.states.read(SUBJECT_ID)).resolves.toEqual(valid);

    const firstEntry = entries[0];
    if (firstEntry === undefined) throw new Error("Expected a non-empty material manifest.");
    const invalidStates = [
      makeState(SUBJECT_ID, [...entries].reverse()),
      makeState(SUBJECT_ID, [firstEntry, firstEntry]),
    ];
    for (const invalid of invalidStates) {
      await expectErrorCode(harness.states.write(invalid), "storage_corrupt");
      await writeJson(harness.layout.stateFile(SUBJECT_ID), invalid);
      await expectErrorCode(harness.states.read(SUBJECT_ID), "storage_corrupt");
    }
  });

  it("keeps event and operation facts immutable and subject-associated", async () => {
    const harness = await createHarness();
    await harness.spaces.write(makeSpace());
    await harness.subjects.write(makeSubject());
    await harness.subjects.write(makeSubject(OTHER_SUBJECT_ID, SPACE_ID, "Grace"));

    const event = makeEvent();
    await harness.events.write(SUBJECT_ID, event);
    await harness.events.write(SUBJECT_ID, event);
    await expectErrorCode(
      harness.events.write(SUBJECT_ID, makeEvent(EVENT_ID, SUBJECT_ID, LATER)),
      "storage_corrupt",
    );
    await expectErrorCode(
      harness.events.write(SUBJECT_ID, makeEvent(OTHER_EVENT_ID, OTHER_SUBJECT_ID)),
      "storage_corrupt",
    );

    const operation = makeOperation();
    await harness.operations.write(SUBJECT_ID, operation);
    await harness.operations.write(SUBJECT_ID, operation);
    await expectErrorCode(
      harness.operations.write(SUBJECT_ID, makeOperation(REQUEST_ID, SUBJECT_ID, LATER)),
      "storage_corrupt",
    );
    await expectErrorCode(
      harness.operations.write(SUBJECT_ID, makeOperation(OTHER_REQUEST_ID, OTHER_SUBJECT_ID)),
      "storage_corrupt",
    );

    await writeJson(harness.layout.eventFile(SUBJECT_ID, EVENT_ID), makeEvent(OTHER_EVENT_ID));
    await expectErrorCode(harness.events.read(SUBJECT_ID, EVENT_ID), "storage_corrupt");
    await writeJson(
      harness.layout.operationFile(SUBJECT_ID, REQUEST_ID),
      makeOperation(OTHER_REQUEST_ID),
    );
    await expectErrorCode(harness.operations.read(SUBJECT_ID, REQUEST_ID), "storage_corrupt");
  });

  it("rejects symbolic links at every concrete fact-store path", async () => {
    const harness = await createHarness();
    const { material } = await seedAllStores(harness);

    const cases: readonly {
      readonly path: string;
      readonly read: () => Promise<unknown>;
    }[] = [
      { path: harness.layout.spaceFile(SPACE_ID), read: () => harness.spaces.read(SPACE_ID) },
      {
        path: harness.layout.subjectFile(SUBJECT_ID),
        read: () => harness.subjects.read(SUBJECT_ID),
      },
      {
        path: harness.layout.materialDirectory(SUBJECT_ID, material.id),
        read: () => harness.materials.read(SUBJECT_ID, material.id),
      },
      { path: harness.layout.stateFile(SUBJECT_ID), read: () => harness.states.read(SUBJECT_ID) },
      {
        path: harness.layout.eventFile(SUBJECT_ID, EVENT_ID),
        read: () => harness.events.read(SUBJECT_ID, EVENT_ID),
      },
      {
        path: harness.layout.operationFile(SUBJECT_ID, REQUEST_ID),
        read: () => harness.operations.read(SUBJECT_ID, REQUEST_ID),
      },
    ];

    for (const [index, testCase] of cases.entries()) {
      const backup = `${testCase.path}.fact-store-test-${index}`;
      await rename(testCase.path, backup);
      await symlink(backup, testCase.path);
      await expectErrorCode(testCase.read(), "storage_corrupt");
      await unlink(testCase.path);
      await rename(backup, testCase.path);
    }
  });

  it("does not leak fact bodies through corruption errors", async () => {
    const harness = await createHarness();
    await seedSubject(harness);
    const content = "private evidence that must not appear in diagnostics";
    const material = makeMaterial(content);
    await harness.materials.write(material, content);
    await writeFile(harness.layout.materialContentFile(SUBJECT_ID, material.id), `${content}!`);

    try {
      await harness.materials.read(SUBJECT_ID, material.id);
      throw new Error("Expected storage corruption.");
    } catch (error) {
      expect(error).toBeInstanceOf(DistillyError);
      expect(String(error)).not.toContain(content);
    }
  });

  it("persists canonical JSON rather than caller object formatting", async () => {
    const harness = await createHarness();
    const record = makeSpace();
    await harness.spaces.write(record);
    const bytes = await readFile(harness.layout.spaceFile(SPACE_ID), "utf8");
    expect(bytes).toBe(CANONICAL_SPACE_BYTES);
  });
});
