import type { DistillyWireError } from "../errors.js";
import type {
  ContentDigest,
  HostName,
  IsoDateTime,
  SpaceId,
  SubjectId,
  VersionId,
} from "../ids.js";
import type { PendingJob } from "./jobs.js";
import type { IngestResult, IngestSubjectTarget, MaterialInput } from "./materials.js";
import type { SubjectRef, SubjectSummary } from "./subjects.js";
import type { ReviewRef, VersionSummary } from "./versions.js";

export type CapabilityAvailability = "available" | "unavailable" | "unknown";

/** Host features known to the canonical skill after trusted detection. */
export interface HostCapabilities {
  readonly webResearch: CapabilityAvailability;
  readonly localFileRead: CapabilityAvailability;
  readonly vision: CapabilityAvailability;
  readonly documentTextExtraction: CapabilityAvailability;
  readonly imageOcr: CapabilityAvailability;
  readonly audioTranscription: CapabilityAvailability;
  readonly videoCaptions: CapabilityAvailability;
  readonly privateUiCapture: CapabilityAvailability;
  readonly windowScopedCapture: CapabilityAvailability;
  readonly captureDataPolicy: "known" | "unknown";
  readonly structuredToolCalls: boolean;
  readonly lifecycleHooks: readonly ("session_start" | "session_end" | "command")[];
  readonly subruns: boolean;
  readonly subrunsInheritMcp: boolean;
  readonly opensLoopbackUrls: boolean;
  readonly maxContextTokens?: number;
  readonly maxToolResultBytes?: number;
}

/** Host capability probe result and actionable compatibility warnings. */
export interface HostPreflight {
  readonly ok: boolean;
  readonly capabilities: HostCapabilities;
  readonly warnings: readonly string[];
  readonly remediation?: string;
}

export type PrivateUiCaptureRange =
  | {
      readonly kind: "time";
      readonly from: IsoDateTime;
      readonly to: IsoDateTime;
    }
  | {
      readonly kind: "visible_message_range";
      readonly startLabel: string;
      readonly endLabel: string;
    };

/** Human-readable, text-only boundary for one private capture grant. */
export interface PrivateUiCaptureScope {
  readonly subject: IngestSubjectTarget;
  readonly application: string;
  readonly accountLabel: string;
  readonly threadLabel: string;
  readonly range: PrivateUiCaptureRange;
  readonly textOnly: true;
  readonly purpose: "profile_distillation";
}

/** Serializable authorization metadata returned by trusted host UI. */
export interface PrivateUiCaptureAuthorization {
  readonly expiresAt: IsoDateTime;
  readonly authorityAttested: true;
  readonly hostProcessingDisclosed: true;
  readonly isolation: "window" | "region";
  readonly dataPolicyUri: string;
  readonly dataPolicyVersion: string;
  readonly retentionNoticeVersion: string;
  readonly conversationLocator:
    | {
        readonly kind: "stable";
        readonly applicationId: string;
        readonly accountLocator: string;
        readonly threadLocator: string;
      }
    | { readonly kind: "subject_fallback" };
}

export type PrivateUiCaptureGuardStopReason =
  | "user_cancelled"
  | "authorization_expired"
  | "idle_timeout"
  | "screen_locked"
  | "account_changed"
  | "thread_changed"
  | "window_changed"
  | "scope_exceeded"
  | "isolation_lost"
  | "controller_failed"
  | "host_shutdown";

export type PrivateUiCaptureActionAbortReason =
  PrivateUiCaptureGuardStopReason | "coordinator_aborted";

export type PrivateUiCaptureStopReason =
  PrivateUiCaptureActionAbortReason | "ingest_rejected" | "process_terminated";

export type PrivateUiCaptureAuditStop = "completed" | PrivateUiCaptureStopReason;

export type PrivateUiCaptureGrantStatus =
  | {
      readonly kind: "active";
      readonly boundaryRefusalCount: number;
    }
  | {
      readonly kind: "revoked";
      readonly reason: PrivateUiCaptureGuardStopReason;
      readonly boundaryRefusalCount: number;
    };

export type PrivateUiCaptureRefusalReason =
  | "user_declined"
  | "scope_unsupported"
  | "isolation_unavailable"
  | "data_policy_unknown"
  | "authority_not_attested";

/** Typed private-capture refusal that never carries a grant handle. */
export interface PrivateUiCaptureRefused {
  readonly kind: "refused";
  readonly reason: PrivateUiCaptureRefusalReason;
}

/** Normalized text materials produced by a trusted capture controller. */
export interface CapturedPrivateTranscript {
  readonly materials: readonly MaterialInput[];
}

export type PrivateUiCaptureIngestResult =
  | (Extract<IngestResult, { readonly kind: "ingested" }> & {
      readonly job: PendingJob;
    })
  | Extract<IngestResult, { readonly kind: "unchanged" }>;

export type PrivateUiCaptureActionResult =
  | { readonly kind: "ingested"; readonly result: PrivateUiCaptureIngestResult }
  | PrivateUiCaptureRefused
  | {
      readonly kind: "aborted";
      readonly reason: PrivateUiCaptureActionAbortReason;
    }
  | {
      readonly kind: "failed";
      readonly error: DistillyWireError;
    };

/** Optional version and destination overrides for a host installation. */
export interface InstallOptions {
  readonly versionId?: VersionId;
  readonly destination?: string;
}

/** Requests a host-owned installation for one profile version. */
export interface InstallInput extends SubjectRef {
  readonly host: HostName;
  readonly options?: InstallOptions;
}

/** Exact projection manifest returned by a host installation. */
export interface InstallRef {
  readonly id: string;
  readonly host: HostName;
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly path: string;
  readonly contentDigest: ContentDigest;
  readonly installedAt: IsoDateTime;
}

/** Identifies an engine-owned installation projection to remove. */
export interface UninstallInput {
  readonly install: InstallRef;
}

/** Explicit destination and version policy for host export. */
export interface ExportOptions {
  readonly destination: string;
  readonly versionId?: VersionId;
  readonly overwrite?: boolean;
}

/** Requests an identity export through a registered host binding. */
export interface HostExportInput extends SubjectRef {
  readonly host: HostName;
  readonly options: ExportOptions;
}

/** Manifest for one host-rendered identity export. */
export interface ExportRef {
  readonly host: HostName;
  readonly subjectId: SubjectId;
  readonly versionId: VersionId;
  readonly path: string;
  readonly contentDigest: ContentDigest;
}

/** Health result for one installed host, adapter, or parser extension. */
export interface ExtensionStatus {
  readonly id: string;
  readonly kind: "host" | "adapter" | "parser";
  readonly ok: boolean;
  readonly version?: string;
  readonly warnings: readonly string[];
}

/** Optional host filter for a runtime diagnostic snapshot. */
export interface DoctorInput {
  readonly host?: HostName;
}

/** Sanitized runtime, storage, panel, and extension diagnostics. */
export interface DoctorSnapshot {
  readonly runtime: {
    readonly productVersion: string;
    readonly wireVersion: string;
    readonly promptVersion: string;
  };
  readonly storage: {
    readonly rootLabel: string;
    readonly writable: boolean;
    readonly schemaSupported: boolean;
    readonly projectionsDirty: boolean;
  };
  readonly panel: {
    readonly loopbackOnly: boolean;
    readonly authentication: "enabled" | "unavailable";
  };
  readonly extensions: readonly ExtensionStatus[];
}

/** Local path to a bundle that must be inspected before import. */
export interface BundleInspectInput {
  readonly path: string;
}

/** Safe metadata extracted from a candidate bundle. */
export interface BundleInspection {
  readonly displayName: string;
  readonly claimCount: number;
  readonly evidenceExcerptCount: number;
  readonly license: string;
  readonly signature: "valid" | "missing" | "invalid";
  readonly warnings: readonly string[];
}

/** Explicitly confirmed import of a previously inspected bundle. */
export interface BundleImportInput extends BundleInspectInput {
  readonly spaceId?: SpaceId;
  readonly confirmation: string;
}

/** Suspended candidate and subject created by bundle import. */
export interface BundleImportResult {
  readonly subject: SubjectSummary;
  readonly candidate: VersionSummary;
  readonly review: ReviewRef;
}

/** Version, destination, and provenance policy for bundle export. */
export interface BundleExportInput extends SubjectRef {
  readonly versionId?: VersionId;
  readonly destination: string;
  readonly provenancePolicy: "none" | "citations_and_quotes";
}

/** Digest-addressed bundle artifact returned after export. */
export interface BundleExportResult {
  readonly path: string;
  readonly contentDigest: ContentDigest;
}
