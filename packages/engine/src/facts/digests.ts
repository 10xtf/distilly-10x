import type {
  ContentDigest,
  MaterialId,
  MaterialRecord,
  MaterialSetHash,
  ProvenanceDigest,
  VersionMaterialEntry,
} from "@distilly/protocol";

import { storageCorrupt } from "../internal-errors.js";
import { canonicalJsonBytes } from "./canonical-json.js";
import { sha256Hex } from "./checksum.js";

const PROVENANCE_NAMESPACE = "distilly:provenance:v1\0";
const MATERIAL_SET_NAMESPACE = "distilly:material-set:v1\0";

/**
 * Hashes normalized UTF-8 material text with full SHA-256.
 *
 * @param content - Normalized material text to hash.
 * @returns The content digest used by material identities.
 */
export const digestContent = (content: string): ContentDigest =>
  `sha256_${sha256Hex(content)}` as ContentDigest;

const provenanceSource = (record: MaterialRecord) => ({
  medium: record.source.medium,
  access: record.source.access,
  ...(record.source.role === undefined ? {} : { role: record.source.role }),
  ...(record.source.artifact === undefined ? {} : { artifact: record.source.artifact }),
  ...(record.source.representationOf === undefined
    ? {}
    : { representationOf: record.source.representationOf }),
  ...(record.source.occurredAt === undefined ? {} : { occurredAt: record.source.occurredAt }),
  ...(record.source.publishedAt === undefined ? {} : { publishedAt: record.source.publishedAt }),
  ...(record.source.language === undefined ? {} : { language: record.source.language }),
  authors: record.source.authors,
});

/**
 * Recomputes the provenance fields that affect grouping, safety, and export.
 *
 * @param record - Material record containing the normalized provenance fields.
 * @returns The namespaced provenance digest.
 */
export const digestMaterialProvenance = (record: MaterialRecord): ProvenanceDigest => {
  const preimage = {
    kind: record.kind,
    source: provenanceSource(record),
    derivation: record.derivation,
    participants: record.participants,
    sensitivity: record.sensitivity,
    flags: record.flags,
    ...(record.correctionProvenance === undefined
      ? {}
      : { correctionProvenance: record.correctionProvenance }),
    ...(record.captureAuditRef === undefined ? {} : { captureAuditRef: record.captureAuditRef }),
    ...(record.conversationSourceKey === undefined
      ? {}
      : { conversationSourceKey: record.conversationSourceKey }),
  };
  return `provenance_sha256_${sha256Hex(
    new Uint8Array([
      ...new TextEncoder().encode(PROVENANCE_NAMESPACE),
      ...canonicalJsonBytes(preimage),
    ]),
  )}` as ProvenanceDigest;
};

/**
 * Derives a material id from source, provenance, and content identities.
 *
 * @param sourceIdentity - Stable source identity participating in material identity.
 * @param provenanceDigest - Digest of provenance fields that affect identity.
 * @param contentDigest - Digest of the normalized material text.
 * @returns The deterministic content-addressed material identifier.
 */
export const deriveMaterialId = (
  sourceIdentity: string,
  provenanceDigest: ProvenanceDigest,
  contentDigest: ContentDigest,
): MaterialId => {
  if (sourceIdentity.includes("\0")) {
    throw storageCorrupt("Material source identity contains the reserved NUL separator.");
  }
  return `mat_${sha256Hex(`${sourceIdentity}\0${provenanceDigest}\0${contentDigest}`)}` as MaterialId;
};

/**
 * Hashes a current or historical material manifest independent of input order.
 *
 * @param entries - Material identifiers and content digests in the manifest.
 * @returns The deterministic material-set hash.
 */
export const hashMaterialSet = (entries: readonly VersionMaterialEntry[]): MaterialSetHash => {
  const ordered = [...entries].sort((left, right) =>
    left.materialId < right.materialId ? -1 : left.materialId > right.materialId ? 1 : 0,
  );
  const body = ordered.map((entry) => `${entry.materialId}\0${entry.contentDigest}`).join("\0");
  return `set_sha256_${sha256Hex(`${MATERIAL_SET_NAMESPACE}${body}`)}` as MaterialSetHash;
};

/**
 * Verifies every content-addressed identity stored beside a material body.
 *
 * @param record - Stored material record to verify.
 * @param content - Exact material body read from content.txt.
 */
export const verifyMaterialIdentity = (record: MaterialRecord, content: string): void => {
  if (digestContent(content) !== record.contentDigest) {
    throw storageCorrupt("Material content digest does not match content.txt.");
  }
  if (digestMaterialProvenance(record) !== record.provenanceDigest) {
    throw storageCorrupt("Material provenance digest does not match its record.");
  }
  if (
    deriveMaterialId(record.sourceIdentity, record.provenanceDigest, record.contentDigest) !==
    record.id
  ) {
    throw storageCorrupt("Material id does not match source, provenance, and content digests.");
  }
};
