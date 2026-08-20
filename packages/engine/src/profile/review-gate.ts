import type {
  ClaimId,
  FacetPath,
  MaterialId,
  QualitySummary,
  ReviewReason,
} from "@distilly/protocol";

import { storageCorrupt } from "../internal-errors.js";
import type { SemanticClaim } from "./apply-patch.js";
import { compareUtf8 } from "./claim-id.js";
import type { MaterialEvidenceIndex } from "./quality.js";

/** Immutable profile facts compared by the host-distill quality gate. */
interface ReviewProfileFacts {
  readonly claims: readonly SemanticClaim[];
  readonly quality: QualitySummary;
}

/** Complete pure input for host-distill review reason derivation. */
export interface HostReviewGateInput {
  readonly before?: ReviewProfileFacts;
  readonly after: ReviewProfileFacts;
  readonly materials: MaterialEvidenceIndex;
  readonly reviewRequest?: { readonly note?: string };
}

const activeIds = (claims: readonly SemanticClaim[], root: string): ReadonlySet<ClaimId> =>
  new Set(
    claims
      .filter((claim) => claim.status === "active" && claim.facet.split(".", 1)[0] === root)
      .map((claim) => claim.id),
  );

const contestedIds = (claims: readonly SemanticClaim[]): ReadonlySet<ClaimId> =>
  new Set(claims.filter((claim) => claim.status === "contested").map((claim) => claim.id));

const relevantMaterialIds = (claims: readonly SemanticClaim[]): ReadonlySet<MaterialId> =>
  new Set(
    claims
      .filter((claim) => claim.status === "active" || claim.status === "contested")
      .flatMap((claim) => claim.evidence.map((evidence) => evidence.materialId)),
  );

const difference = <T extends string>(left: ReadonlySet<T>, right: ReadonlySet<T>): readonly T[] =>
  [...left].filter((value) => !right.has(value)).sort(compareUtf8);

const requireMatchingGroupingVersion = (
  profile: ReviewProfileFacts,
  materials: MaterialEvidenceIndex,
): void => {
  if (profile.quality.sourceGroupingVersion !== materials.sourceGroupingVersion) {
    throw storageCorrupt("Review quality does not match the pinned material evidence index.");
  }
};

/**
 * Derives the exact ordered Step 7 host review reasons without semantic inference.
 *
 * @param input - Before/after profiles, pinned evidence, and optional manual request.
 * @returns Canonically ordered mechanical host review reasons.
 */
export const evaluateHostReviewReasons = (input: HostReviewGateInput): readonly ReviewReason[] => {
  requireMatchingGroupingVersion(input.after, input.materials);
  if (input.before !== undefined) requireMatchingGroupingVersion(input.before, input.materials);

  const reasons: ReviewReason[] = [];
  if (input.before !== undefined) {
    const beforeIdentity = activeIds(input.before.claims, "identity");
    const afterIdentity = activeIds(input.after.claims, "identity");
    const identityChanged = difference(beforeIdentity, afterIdentity);
    if (identityChanged.length > 0) {
      reasons.push({ code: "identity_changed", claimIds: identityChanged });
    }

    const coverageDecreased = difference(
      new Set<FacetPath>(input.before.quality.coveredCoreFacets as readonly FacetPath[]),
      new Set<FacetPath>(input.after.quality.coveredCoreFacets as readonly FacetPath[]),
    );
    if (coverageDecreased.length > 0) {
      reasons.push({ code: "coverage_decreased", facets: coverageDecreased });
    }

    const beforeVoice = activeIds(input.before.claims, "voice");
    const afterVoice = activeIds(input.after.claims, "voice");
    const voiceRemoved = difference(beforeVoice, afterVoice);
    if (voiceRemoved.length > 0) {
      reasons.push({ code: "voice_examples_removed", claimIds: voiceRemoved });
    }

    const newlyContested = difference(
      contestedIds(input.after.claims),
      contestedIds(input.before.claims),
    );
    if (newlyContested.length > 0) {
      reasons.push({ code: "new_contested_claims", claimIds: newlyContested });
    }

    if (
      input.after.quality.diversityEligibleSourceGroupCount <
      input.before.quality.diversityEligibleSourceGroupCount
    ) {
      reasons.push({ code: "source_diversity_decreased" });
    }
  }

  const beforeMaterials =
    input.before === undefined ? new Set<MaterialId>() : relevantMaterialIds(input.before.claims);
  const suspicious = difference(relevantMaterialIds(input.after.claims), beforeMaterials).filter(
    (materialId) => {
      const facts = input.materials.byMaterial.get(materialId);
      if (facts === undefined) {
        throw storageCorrupt("Review candidate cites a material missing from its evidence index.");
      }
      return facts.flags.includes("suspicious_source");
    },
  );
  if (suspicious.length > 0) {
    reasons.push({ code: "suspicious_source", materialIds: suspicious });
  }

  if (input.reviewRequest !== undefined) {
    reasons.push({
      code: "manual_review_requested",
      ...(input.reviewRequest.note === undefined ? {} : { note: input.reviewRequest.note }),
    });
  }
  return reasons;
};
