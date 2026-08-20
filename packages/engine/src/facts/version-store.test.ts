import {
  DistillyError,
  claimIdSchema,
  facetPathSchema,
  isoDateTimeSchema,
  materialIdSchema,
  provenanceDigestSchema,
  spaceIdSchema,
  subjectIdSchema,
  versionClaimsSnapshotSchema,
  versionIdSchema,
  versionMaterialManifestSchema,
  versionRecordSchema,
} from "@distilly/protocol";
import type {
  Claim,
  DistillyErrorCode,
  MaterialRecord,
  RuntimeSchema,
  SpaceRecord,
  SubjectRecord,
  VersionClaimsSnapshot,
  VersionMaterialEntry,
  VersionMaterialManifest,
  VersionRecord,
} from "@distilly/protocol";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Layout } from "../layout.js";
import { sealFact } from "./checksum.js";
import {
  deriveMaterialId,
  digestContent,
  digestMaterialProvenance,
  hashMaterialSet,
} from "./digests.js";
import { createFactFile, replaceFactFile } from "./fact-file.js";
import { FileMaterialStore } from "./material-store.js";
import { FileSpaceStore } from "./space-store.js";
import { FileSubjectStore } from "./subject-store.js";
import { FileVersionStore } from "./version-store.js";

const ZERO_32 = "0".repeat(32);
const ONE_32 = "1".repeat(32);
const ZERO_64 = "0".repeat(64);
const ONE_64 = "1".repeat(64);
const TWO_64 = "2".repeat(64);
const SPACE_ID = spaceIdSchema.parse(`space_${ZERO_32}`);
const SUBJECT_ID = subjectIdSchema.parse(`subject_${ZERO_32}`);
const OTHER_SUBJECT_ID = subjectIdSchema.parse(`subject_${ONE_32}`);
const VERSION_ID = versionIdSchema.parse(`version_${ZERO_64}`);
const OTHER_VERSION_ID = versionIdSchema.parse(`version_${ONE_64}`);
const CLAIM_ID = claimIdSchema.parse(`claim_${ZERO_64}`);
const OTHER_MATERIAL_ID = materialIdSchema.parse(`mat_${TWO_64}`);
const AT = isoDateTimeSchema.parse("2026-08-20T00:00:00.000Z");
const CONTENT = "A😀BC and Ada writes.\n";

const VERSION_SCHEMA: RuntimeSchema<VersionRecord> = {
  parse(value) {
    return versionRecordSchema.parse(value) as VersionRecord;
  },
};

const MANIFEST_SCHEMA: RuntimeSchema<VersionMaterialManifest> = {
  parse(value) {
    return versionMaterialManifestSchema.parse(value);
  },
};

const CLAIMS_SCHEMA: RuntimeSchema<VersionClaimsSnapshot> = {
  parse(value) {
    return versionClaimsSnapshotSchema.parse(value) as VersionClaimsSnapshot;
  },
};

const QUALITY = {
  sourceGroupingVersion: "source-groups-v1",
  activeClaimCount: 1,
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

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const expectCode = async (promise: Promise<unknown>, code: DistillyErrorCode): Promise<void> => {
  try {
    await promise;
    throw new Error(`Expected ${code}.`);
  } catch (error) {
    expect(error).toBeInstanceOf(DistillyError);
    expect(error).toMatchObject({ code });
  }
};

const makeMaterial = (): MaterialRecord => {
  const contentDigest = digestContent(CONTENT);
  const provisional = sealFact<MaterialRecord>({
    schemaVersion: 1,
    id: materialIdSchema.parse(`mat_${ONE_64}`),
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

const entryFor = (material: MaterialRecord): VersionMaterialEntry => ({
  materialId: material.id,
  contentDigest: material.contentDigest,
  provenanceDigest: material.provenanceDigest,
});

const makeClaim = (
  materialId: MaterialRecord["id"],
  quote = "😀",
  locator: Claim["evidence"][number]["locator"] | undefined = { start: 1, end: 2 },
): Claim => ({
  id: CLAIM_ID,
  facet: facetPathSchema.parse("identity"),
  text: "Ada writes.",
  evidence: [{ materialId, quote, ...(locator === undefined ? {} : { locator }) }],
  status: "active",
  strength: "single_source",
  observedIn: ["2026"],
  createdIn: VERSION_ID,
});

interface Fixture {
  readonly root: string;
  readonly layout: Layout;
  readonly store: FileVersionStore;
  readonly material: MaterialRecord;
  readonly version: VersionRecord;
  readonly manifest: VersionMaterialManifest;
  readonly claims: VersionClaimsSnapshot;
}

const createFixture = async (): Promise<Fixture> => {
  const root = await mkdtemp(join(tmpdir(), "distilly-version-store-"));
  roots.push(root);
  const layout = new Layout(root);
  const spaces = new FileSpaceStore(layout);
  const subjects = new FileSubjectStore(layout, spaces);
  const materials = new FileMaterialStore(layout, subjects);
  const store = new FileVersionStore(layout, materials);
  const space = sealFact<SpaceRecord>({
    schemaVersion: 1,
    id: SPACE_ID,
    displayName: "People",
    kind: "people",
  });
  const subject = sealFact<SubjectRecord>({
    schemaVersion: 1,
    id: SUBJECT_ID,
    spaceId: SPACE_ID,
    displayName: "Ada",
    aliases: [],
    identityHints: [],
    lifecycle: "active",
  });
  await spaces.write(space);
  await subjects.write(subject);

  const material = makeMaterial();
  await materials.write(material, CONTENT);
  const items = [entryFor(material)];
  const version = sealFact<VersionRecord>({
    schemaVersion: 1,
    id: VERSION_ID,
    subjectId: SUBJECT_ID,
    generation: 1,
    materialSetHash: hashMaterialSet(items),
    materialCount: items.length,
    creation: { kind: "renderer_only", sourceVersionId: VERSION_ID },
    createdDisposition: "current",
    actor: { kind: "system", id: "version-store-test" },
    quality: QUALITY,
    rendererVersion: "renderer-v1",
    createdAt: AT,
  });
  const manifest = sealFact<VersionMaterialManifest>({ schemaVersion: 1, items });
  const claims = sealFact<VersionClaimsSnapshot>({
    schemaVersion: 1,
    subjectId: SUBJECT_ID,
    versionId: VERSION_ID,
    claims: [makeClaim(material.id)],
  });
  await createFactFile(root, layout.versionFile(SUBJECT_ID, VERSION_ID), version, VERSION_SCHEMA);
  await createFactFile(
    root,
    layout.versionMaterialManifestFile(SUBJECT_ID, VERSION_ID),
    manifest,
    MANIFEST_SCHEMA,
  );
  await createFactFile(
    root,
    layout.versionClaimsFile(SUBJECT_ID, VERSION_ID),
    claims,
    CLAIMS_SCHEMA,
  );
  return { root, layout, store, material, version, manifest, claims };
};

const replaceClaims = async (
  fixture: Fixture,
  input: Omit<VersionClaimsSnapshot, "checksum">,
): Promise<VersionClaimsSnapshot> => {
  const claims = sealFact<VersionClaimsSnapshot>(input);
  await replaceFactFile(
    fixture.root,
    fixture.layout.versionClaimsFile(SUBJECT_ID, VERSION_ID),
    claims,
    CLAIMS_SCHEMA,
  );
  return claims;
};

describe("FileVersionStore", () => {
  it("returns a complete version whose emoji locator uses Unicode scalar offsets", async () => {
    const fixture = await createFixture();

    await expect(fixture.store.read(SUBJECT_ID, VERSION_ID)).resolves.toEqual({
      version: fixture.version,
      manifest: fixture.manifest,
      claims: fixture.claims,
    });
  });

  it("rejects each missing required immutable version file", async () => {
    for (const selectPath of [
      (fixture: Fixture) => fixture.layout.versionFile(SUBJECT_ID, VERSION_ID),
      (fixture: Fixture) => fixture.layout.versionMaterialManifestFile(SUBJECT_ID, VERSION_ID),
      (fixture: Fixture) => fixture.layout.versionClaimsFile(SUBJECT_ID, VERSION_ID),
    ]) {
      const fixture = await createFixture();
      await rm(selectPath(fixture));
      await expectCode(fixture.store.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");
    }
  });

  it("rejects claims snapshots whose subject or version does not match the path", async () => {
    for (const mismatch of [
      { subjectId: OTHER_SUBJECT_ID, versionId: VERSION_ID },
      { subjectId: SUBJECT_ID, versionId: OTHER_VERSION_ID },
    ]) {
      const fixture = await createFixture();
      await replaceClaims(fixture, {
        schemaVersion: 1,
        ...mismatch,
        claims: fixture.claims.claims,
      });
      await expectCode(fixture.store.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");
    }
  });

  it("rejects claim evidence outside the historical material manifest", async () => {
    const fixture = await createFixture();
    await replaceClaims(fixture, {
      schemaVersion: 1,
      subjectId: SUBJECT_ID,
      versionId: VERSION_ID,
      claims: [makeClaim(OTHER_MATERIAL_ID)],
    });

    await expectCode(fixture.store.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");
  });

  it("rejects an evidence quote or scalar locator that does not match real content", async () => {
    for (const [quote, locator] of [
      ["not stored", undefined],
      ["😀", { start: 2, end: 3 }],
      ["😀", { start: 1, end: 99 }],
    ] satisfies readonly (readonly [string, Claim["evidence"][number]["locator"] | undefined])[]) {
      const fixture = await createFixture();
      await replaceClaims(fixture, {
        schemaVersion: 1,
        subjectId: SUBJECT_ID,
        versionId: VERSION_ID,
        claims: [makeClaim(fixture.material.id, quote, locator)],
      });
      await expectCode(fixture.store.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");
    }
  });

  it("rejects a missing or digest-mismatched manifest material", async () => {
    const missing = await createFixture();
    await rm(missing.layout.materialDirectory(SUBJECT_ID, missing.material.id), {
      recursive: true,
    });
    await expectCode(missing.store.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");

    const mismatched = await createFixture();
    const items = [
      {
        ...entryFor(mismatched.material),
        provenanceDigest: provenanceDigestSchema.parse(`provenance_sha256_${ONE_64}`),
      },
    ];
    const version = sealFact<VersionRecord>({
      ...mismatched.version,
      materialSetHash: hashMaterialSet(items),
    });
    const manifest = sealFact<VersionMaterialManifest>({ schemaVersion: 1, items });
    await replaceFactFile(
      mismatched.root,
      mismatched.layout.versionFile(SUBJECT_ID, VERSION_ID),
      version,
      VERSION_SCHEMA,
    );
    await replaceFactFile(
      mismatched.root,
      mismatched.layout.versionMaterialManifestFile(SUBJECT_ID, VERSION_ID),
      manifest,
      MANIFEST_SCHEMA,
    );
    await expectCode(mismatched.store.read(SUBJECT_ID, VERSION_ID), "storage_corrupt");
  });
});
