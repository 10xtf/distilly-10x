import { DistillyError, versionClaimsSnapshotSchema } from "@distilly/protocol";
import type {
  RuntimeSchema,
  SubjectId,
  VersionClaimsSnapshot,
  VersionId,
  VersionMaterialManifest,
  VersionRecord,
} from "@distilly/protocol";

import { storageCorrupt } from "../internal-errors.js";
import { Layout } from "../layout.js";
import { readFactFile } from "./fact-file.js";
import type { FileMaterialStore } from "./material-store.js";
import { FileVersionManifestStore } from "./version-manifest-store.js";

const storedClaimsSchema: RuntimeSchema<VersionClaimsSnapshot> = {
  parse(value) {
    return versionClaimsSnapshotSchema.parse(value) as VersionClaimsSnapshot;
  },
};

const isNotFound = (error: unknown): boolean =>
  error instanceof DistillyError && error.code === "not_found";

/** Fully verified immutable version facts. */
export interface StoredVersion {
  readonly version: VersionRecord;
  readonly manifest: VersionMaterialManifest;
  readonly claims: VersionClaimsSnapshot;
}

/** Verified reader for an immutable version, its membership, and its claims. */
export class FileVersionStore {
  readonly #layout: Layout;
  readonly #materials: FileMaterialStore;
  readonly #manifests: FileVersionManifestStore;

  /**
   * Creates a complete immutable-version reader.
   *
   * @param layout - Confined local fact layout.
   * @param materials - Store used to verify manifest members and evidence bodies.
   */
  constructor(layout: Layout, materials: FileMaterialStore) {
    this.#layout = layout;
    this.#materials = materials;
    this.#manifests = new FileVersionManifestStore(layout, materials);
  }

  /**
   * Reads and cross-validates all required facts for one immutable version.
   *
   * @param subjectId - Subject that owns the immutable version.
   * @param versionId - Profile version to load.
   * @returns The verified version, material manifest, and claims snapshot.
   */
  async read(subjectId: SubjectId, versionId: VersionId): Promise<StoredVersion> {
    let version: VersionRecord;
    let manifest: VersionMaterialManifest;
    try {
      ({ version, manifest } = await this.#manifests.read(subjectId, versionId));
    } catch (error) {
      if (isNotFound(error)) {
        throw storageCorrupt("Version directory is missing version.json.", error);
      }
      throw error;
    }

    let claims: VersionClaimsSnapshot;
    try {
      claims = await readFactFile(
        this.#layout.root,
        this.#layout.versionClaimsFile(subjectId, versionId),
        storedClaimsSchema,
      );
    } catch (error) {
      if (isNotFound(error)) {
        throw storageCorrupt("Version directory is missing claims.json.", error);
      }
      throw error;
    }
    if (claims.subjectId !== subjectId || claims.subjectId !== version.subjectId) {
      throw storageCorrupt("Version claims subject does not match its fact path.");
    }
    if (claims.versionId !== versionId || claims.versionId !== version.id) {
      throw storageCorrupt("Version claims id does not match its fact path.");
    }

    const manifestMembers = new Set(manifest.items.map((entry) => entry.materialId));
    const materialBodies = new Map<string, string>();
    for (const claim of claims.claims) {
      for (const evidence of claim.evidence) {
        if (!manifestMembers.has(evidence.materialId)) {
          throw storageCorrupt("Version claim references material outside its manifest.");
        }
        let content = materialBodies.get(evidence.materialId);
        if (content === undefined) {
          try {
            content = (await this.#materials.read(subjectId, evidence.materialId)).content;
          } catch (error) {
            if (isNotFound(error)) {
              throw storageCorrupt("Version evidence references a missing material fact.", error);
            }
            throw error;
          }
          materialBodies.set(evidence.materialId, content);
        }
        if (!content.includes(evidence.quote)) {
          throw storageCorrupt("Version evidence quote does not match material content.");
        }
        if (evidence.locator !== undefined) {
          const scalars = Array.from(content);
          const { start, end } = evidence.locator;
          if (
            start >= end ||
            end > scalars.length ||
            scalars.slice(start, end).join("") !== evidence.quote
          ) {
            throw storageCorrupt("Version evidence locator does not match its exact quote.");
          }
        }
      }
    }

    return { version, manifest, claims };
  }
}
