import {
  DistillyError,
  isoDateTimeSchema,
  materialIdSchema,
  provenanceDigestSchema,
  requestIdSchema,
  spaceIdSchema,
  subjectIdSchema,
} from "@distilly/protocol";
import type {
  DistillyErrorCode,
  MaterialRecord,
  SpaceRecord,
  SubjectRecord,
  SubjectStateRecord,
  VersionMaterialEntry,
} from "@distilly/protocol";
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { sealFact } from "../facts/checksum.js";
import {
  deriveMaterialId,
  digestContent,
  digestMaterialProvenance,
  hashMaterialSet,
} from "../facts/digests.js";
import { FileMaterialStore } from "../facts/material-store.js";
import { FileSpaceStore } from "../facts/space-store.js";
import { FileStateStore } from "../facts/state-store.js";
import { FileSubjectStore } from "../facts/subject-store.js";
import { Layout } from "../layout.js";
import { FileIngestStaging } from "./ingest-staging.js";

const ZERO_32 = "0".repeat(32);
const ONE_32 = "1".repeat(32);
const ZERO_64 = "0".repeat(64);
const SPACE_ID = spaceIdSchema.parse(`space_${ZERO_32}`);
const SUBJECT_ID = subjectIdSchema.parse(`subject_${ZERO_32}`);
const REQUEST_ID = requestIdSchema.parse(`req_${ZERO_32}`);
const OTHER_REQUEST_ID = requestIdSchema.parse(`req_${ONE_32}`);
const AT = isoDateTimeSchema.parse("2026-08-20T00:00:00.000Z");
const CONTENT = "Complete staged evidence.\n";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const makeRoot = async (): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-ingest-staging-"));
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

const makeSpace = (): SpaceRecord =>
  sealFact<SpaceRecord>({
    schemaVersion: 1,
    id: SPACE_ID,
    displayName: "People",
    kind: "people",
  });

const makeSubject = (): SubjectRecord =>
  sealFact<SubjectRecord>({
    schemaVersion: 1,
    id: SUBJECT_ID,
    spaceId: SPACE_ID,
    displayName: "Ada",
    aliases: [],
    identityHints: [],
    lifecycle: "active",
  });

const makeMaterial = (): MaterialRecord => {
  const contentDigest = digestContent(CONTENT);
  const provisional = sealFact<MaterialRecord>({
    schemaVersion: 1,
    id: materialIdSchema.parse(`mat_${ZERO_64}`),
    subjectId: SUBJECT_ID,
    kind: "web",
    contentDigest,
    provenanceDigest: provenanceDigestSchema.parse(`provenance_sha256_${ZERO_64}`),
    sourceIdentity: "source-uri-v1\0https://example.com/evidence",
    source: {
      uri: "https://example.com/evidence",
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

const makeState = (material: MaterialRecord): SubjectStateRecord => {
  const materialManifest = [entryFor(material)];
  return sealFact<SubjectStateRecord>({
    schemaVersion: 1,
    subjectId: SUBJECT_ID,
    generation: 1,
    materialSetHash: hashMaterialSet(materialManifest),
    materialManifest,
  });
};

const makeHarness = async () => {
  const root = await makeRoot();
  const layout = new Layout(root);
  const spaces = new FileSpaceStore(layout);
  await spaces.write(makeSpace());
  const subjects = new FileSubjectStore(layout, spaces);
  const materials = new FileMaterialStore(layout, subjects);
  return {
    root,
    layout,
    spaces,
    subjects,
    materials,
    states: new FileStateStore(layout, subjects, materials),
    staging: new FileIngestStaging(layout, spaces),
  };
};

describe("fixed ingest staging", () => {
  it("writes complete private staging and publishes one readable subject directory", async () => {
    const harness = await makeHarness();
    const subject = makeSubject();
    const material = makeMaterial();
    const state = makeState(material);
    await harness.staging.prepare(REQUEST_ID, {
      subject,
      materials: [{ record: material, content: CONTENT }],
      state,
    });

    const staging = harness.layout.ingestStagingDirectory(REQUEST_ID, SUBJECT_ID);
    if (process.platform !== "win32") {
      expect((await stat(staging)).mode & 0o777).toBe(0o700);
      expect(
        (await stat(harness.layout.stagedSubjectFile(REQUEST_ID, SUBJECT_ID))).mode & 0o777,
      ).toBe(0o600);
    }
    await harness.staging.publish(REQUEST_ID, SUBJECT_ID);
    await expect(lstat(staging)).rejects.toMatchObject({ code: "ENOENT" });
    await expect(harness.subjects.read(SUBJECT_ID)).resolves.toEqual(subject);
    await expect(harness.materials.read(SUBJECT_ID, material.id)).resolves.toEqual({
      record: material,
      content: CONTENT,
    });
    await expect(harness.states.read(SUBJECT_ID)).resolves.toEqual(state);
  });

  it("does not replace an existing subject and cleans only the journal-named staging path", async () => {
    const harness = await makeHarness();
    const subject = makeSubject();
    const material = makeMaterial();
    const input = {
      subject,
      materials: [{ record: material, content: CONTENT }],
      state: makeState(material),
    } as const;
    await harness.staging.prepare(REQUEST_ID, input);
    await mkdir(harness.layout.subjectDirectory(SUBJECT_ID), { mode: 0o700 });

    await expect(harness.staging.publish(REQUEST_ID, SUBJECT_ID)).rejects.toMatchObject({
      code: "EEXIST",
    });
    await expect(readdir(harness.layout.subjectDirectory(SUBJECT_ID))).resolves.toEqual([]);
    await writeFile(join(harness.layout.subjectDirectory(SUBJECT_ID), "sentinel"), "existing");
    await harness.staging.cleanup(OTHER_REQUEST_ID, SUBJECT_ID);
    await expect(
      readFile(harness.layout.stagedSubjectFile(REQUEST_ID, SUBJECT_ID), "utf8"),
    ).resolves.toContain(SUBJECT_ID);
    await harness.staging.cleanup(REQUEST_ID, SUBJECT_ID);
    await expect(
      readFile(join(harness.layout.subjectDirectory(SUBJECT_ID), "sentinel"), "utf8"),
    ).resolves.toBe("existing");
    await harness.staging.cleanup(REQUEST_ID, SUBJECT_ID);
  });

  it("fails closed on incomplete, unknown, or symlinked staging paths", async () => {
    const harness = await makeHarness();
    const material = makeMaterial();
    await harness.staging.prepare(REQUEST_ID, {
      subject: makeSubject(),
      materials: [{ record: material, content: CONTENT }],
      state: makeState(material),
    });
    const staging = harness.layout.ingestStagingDirectory(REQUEST_ID, SUBJECT_ID);
    await writeFile(join(staging, "unknown"), "unknown");
    await expectCode(harness.staging.publish(REQUEST_ID, SUBJECT_ID), "storage_corrupt");
    await rm(join(staging, "unknown"));
    await rm(harness.layout.stagedStateFile(REQUEST_ID, SUBJECT_ID));
    await expectCode(harness.staging.publish(REQUEST_ID, SUBJECT_ID), "storage_corrupt");

    await harness.staging.cleanup(REQUEST_ID, SUBJECT_ID);
    const outside = await makeRoot();
    await symlink(outside, staging);
    await expectCode(harness.staging.cleanup(REQUEST_ID, SUBJECT_ID), "storage_corrupt");
    await expect(stat(outside)).resolves.toBeDefined();
  });
});
