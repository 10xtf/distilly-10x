import {
  BUILTIN_HOSTS,
  contentDigestSchema,
  isoDateTimeSchema,
  type ContentDigest,
  type HostCapabilities,
  type HostEnvironment,
  type HostName,
  type HostPreflight,
} from "@distilly/protocol";

import codexCapacityEvidence from "./evidence/host-capacity/codex-cli-0.146.0-cli-distilly-0.0.0-v1.json" with { type: "json" };

interface PreviewReleaseTuple {
  readonly releaseVersion: string;
  readonly canonicalSkillDigest: ContentDigest;
}

interface PreviewCapacityFixture {
  readonly schemaVersion: 1;
  readonly fixtureId: string;
  readonly host: HostName;
  readonly hostVersion: string;
  readonly environment: HostEnvironment;
  readonly releaseVersion: string;
  readonly wireMajor: 3;
  readonly canonicalSkillDigest: ContentDigest;
  readonly toolContractDigest: ContentDigest;
  readonly serializer: "structured-content-plus-json-text-v1";
  readonly capacity: {
    readonly maximumInputTokens: number;
    readonly maximumToolResultBytes: number;
  };
  readonly observed: {
    readonly briefingBytes: number;
    readonly toolResultBytes: number;
    readonly structuredTextDeepEqual: true;
    readonly modelObservedBothTailMarkers: true;
    readonly normalizedTranscriptDigest: ContentDigest;
  };
  readonly verifiedAt: string;
}

const PREVIEW_CAPABILITIES = Object.freeze({
  webResearch: "unknown",
  localFileRead: "available",
  vision: "unknown",
  documentTextExtraction: "unknown",
  imageOcr: "unknown",
  audioTranscription: "unknown",
  videoCaptions: "unknown",
  privateUiCapture: "unavailable",
  windowScopedCapture: "unknown",
  captureDataPolicy: "unknown",
  structuredToolCalls: true,
  lifecycleHooks: [],
  subruns: false,
  subrunsInheritMcp: false,
  opensLoopbackUrls: false,
} as const satisfies HostCapabilities);

const PREVIEW_RELEASE = "0.0.0";
const PREVIEW_SKILL_DIGEST =
  "sha256_cf2952b0420672c1135dbf0329ba8495ea01903b47cff6778b25cc63cca19cb7" as ContentDigest;
const TOOL_CONTRACT_DIGEST =
  "sha256_a5ef4303fa29360416008448f12dd4b01f325143633e7fa2298c2094f73a6eda" as ContentDigest;

const parseEvidence = (value: unknown): PreviewCapacityFixture => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("The host capacity evidence record is invalid.");
  }
  const record = value as Record<string, unknown>;
  const capacity = record.capacity as Record<string, unknown> | undefined;
  const observed = record.observed as Record<string, unknown> | undefined;
  const host = record.host;
  const canonicalSkillDigest = contentDigestSchema.safeParse(record.canonicalSkillDigest);
  const toolContractDigest = contentDigestSchema.safeParse(record.toolContractDigest);
  const transcriptDigest = contentDigestSchema.safeParse(observed?.normalizedTranscriptDigest);
  if (
    record.schemaVersion !== 1 ||
    typeof record.fixtureId !== "string" ||
    (host !== BUILTIN_HOSTS.codex && host !== BUILTIN_HOSTS.claudeCode) ||
    typeof record.hostVersion !== "string" ||
    record.environment !== "cli" ||
    record.releaseVersion !== PREVIEW_RELEASE ||
    record.wireMajor !== 3 ||
    !canonicalSkillDigest.success ||
    canonicalSkillDigest.data !== PREVIEW_SKILL_DIGEST ||
    !toolContractDigest.success ||
    toolContractDigest.data !== TOOL_CONTRACT_DIGEST ||
    record.serializer !== "structured-content-plus-json-text-v1" ||
    capacity === undefined ||
    !Number.isSafeInteger(capacity.maximumInputTokens) ||
    !Number.isSafeInteger(capacity.maximumToolResultBytes) ||
    observed === undefined ||
    observed.briefingBytes !== capacity.maximumInputTokens ||
    observed.toolResultBytes !== capacity.maximumToolResultBytes ||
    observed.structuredTextDeepEqual !== true ||
    observed.modelObservedBothTailMarkers !== true ||
    !transcriptDigest.success ||
    !isoDateTimeSchema.safeParse(record.verifiedAt).success
  ) {
    throw new TypeError("The host capacity evidence record is invalid.");
  }
  return {
    schemaVersion: 1,
    fixtureId: record.fixtureId,
    host: host as HostName,
    hostVersion: record.hostVersion,
    environment: "cli",
    releaseVersion: PREVIEW_RELEASE,
    wireMajor: 3,
    canonicalSkillDigest: canonicalSkillDigest.data,
    toolContractDigest: toolContractDigest.data,
    serializer: "structured-content-plus-json-text-v1",
    capacity: {
      maximumInputTokens: capacity.maximumInputTokens as number,
      maximumToolResultBytes: capacity.maximumToolResultBytes as number,
    },
    observed: {
      briefingBytes: observed.briefingBytes as number,
      toolResultBytes: observed.toolResultBytes as number,
      structuredTextDeepEqual: true,
      modelObservedBothTailMarkers: true,
      normalizedTranscriptDigest: transcriptDigest.data,
    },
    verifiedAt: record.verifiedAt as string,
  };
};

const FIXTURES: readonly PreviewCapacityFixture[] = Object.freeze([
  Object.freeze(parseEvidence(codexCapacityEvidence)),
]);

/**
 * Loads one immutable exact-version net-capacity fixture.
 *
 * @param host - Host selected by the owned plugin command.
 * @param hostVersion - Exact version observed from the installed executable.
 * @param environment - Exact host surface represented by the fixture.
 * @param release - Active release and canonical Skill digest.
 * @returns A trusted preflight payload for the capability binding.
 */
export const loadPreviewHostFixture = (
  host: HostName,
  hostVersion: string,
  environment: HostEnvironment,
  release: PreviewReleaseTuple,
): HostPreflight => {
  const fixture = FIXTURES.find(
    (candidate) =>
      candidate.host === host &&
      candidate.hostVersion === hostVersion &&
      candidate.environment === environment &&
      candidate.releaseVersion === release.releaseVersion &&
      candidate.canonicalSkillDigest === release.canonicalSkillDigest,
  );
  if (fixture === undefined) {
    throw new Error("No verified capacity fixture matches this host version and release.");
  }
  return {
    ok: true,
    capabilities: PREVIEW_CAPABILITIES,
    capacity: {
      maximumInputTokens: fixture.capacity.maximumInputTokens,
      maximumToolResultBytes: fixture.capacity.maximumToolResultBytes,
      source: "binding_fixture",
    },
    evidence: {
      kind: "binding_fixture",
      fixtureId: fixture.fixtureId,
      host: fixture.host,
      hostVersion: fixture.hostVersion,
      environment: fixture.environment,
      releaseVersion: fixture.releaseVersion,
      wireMajor: fixture.wireMajor,
      canonicalSkillDigest: fixture.canonicalSkillDigest,
    },
    warnings: [],
  };
};
