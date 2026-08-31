import type {
  DistillyWireError,
  EmptyResult,
  IdentityHint,
  IngestResult,
  IsoDateTime,
  JsonValue,
  MaterialInput,
  RequestId,
  SubjectRef,
} from "@distilly/protocol";

/** Public, non-secret configuration plus opaque references to separately stored secrets. */
export interface AdapterConfig {
  readonly values: Readonly<Record<string, string>>;
  readonly secretRefs?: Readonly<Record<string, string>>;
}

/** Capabilities advertised by one source adapter without resolving a credential. */
export interface AdapterCapabilities {
  readonly resolveSubject: boolean;
  readonly plan: boolean;
  readonly collect: boolean;
  readonly requiresSecret: boolean;
  readonly resourceKinds: readonly {
    readonly kind: string;
    readonly availability: "available" | "unavailable";
    readonly remediation?: string;
  }[];
}

export type AdapterPreflightResult =
  | {
      readonly ok: true;
      readonly warnings: readonly string[];
    }
  | {
      readonly ok: false;
      readonly error: DistillyWireError;
      readonly warnings: readonly string[];
    };

/** Provider-owned subject identity returned before material collection. */
export interface ExternalSubjectRef {
  readonly adapterId: string;
  readonly externalId: string;
  readonly displayName: string;
  readonly canonicalUri?: string;
  readonly identityHints: readonly IdentityHint[];
}

/** Open resource payload whose exact keys are parsed by the owning adapter. */
export interface AdapterResource {
  readonly kind: string;
  readonly [key: string]: JsonValue;
}

/** Strict parser supplied by an adapter for its own resource payload. */
export interface AdapterResourceSchema<Resource extends AdapterResource> {
  parse(input: unknown): Resource;
}

/** One bounded collection request after adapter-specific resource validation. */
export interface CollectRequest<Resource extends AdapterResource> {
  readonly resource: Resource;
  readonly objective: string;
  readonly since?: IsoDateTime;
  readonly limit?: number;
}

/** Provider-neutral research plan returned by a delegated adapter. */
export interface AgentPlan {
  readonly questions: readonly string[];
  readonly suggestedQueries: readonly string[];
}

/** Methods and metadata shared by direct and delegated source adapters. */
export interface SourceAdapterBase<Resource extends AdapterResource> {
  readonly id: string;
  readonly resourceSchema: AdapterResourceSchema<Resource>;
  capabilities(): AdapterCapabilities;
  preflight(
    request: CollectRequest<Resource>,
    config: AdapterConfig,
  ): Promise<AdapterPreflightResult>;
  resolveSubject(query: string, config: AdapterConfig): Promise<ExternalSubjectRef[]>;
}

/** Adapter that asks a trusted outer agent to execute a provider-neutral plan. */
export interface DelegatedSourceAdapter<
  Resource extends AdapterResource,
> extends SourceAdapterBase<Resource> {
  readonly mode: "delegated";
  plan(subject: ExternalSubjectRef, request: CollectRequest<Resource>): Promise<AgentPlan>;
}

/** Adapter that directly yields normalized text materials within its granted scope. */
export interface DirectSourceAdapter<
  Resource extends AdapterResource,
> extends SourceAdapterBase<Resource> {
  readonly mode: "direct";
  collect(
    subject: ExternalSubjectRef,
    request: CollectRequest<Resource>,
    config: AdapterConfig,
  ): AsyncIterable<MaterialInput>;
}

export type SourceAdapter<Resource extends AdapterResource> =
  DelegatedSourceAdapter<Resource> | DirectSourceAdapter<Resource>;

/** Content-free registry entry safe to expose to a user collection surface. */
export interface SourceAdapterRegistration {
  readonly id: string;
  readonly mode: "delegated" | "direct";
  readonly capabilities: AdapterCapabilities;
}

/** Adapter and adapter-owned resource selected by a direct user action. */
export interface UserCollectionSelection<Resource extends AdapterResource = AdapterResource> {
  readonly adapterId: string;
  readonly resource: Resource;
}

/** Configured state returned without resolved secret values. */
export interface SourceStatus {
  readonly registration: SourceAdapterRegistration;
  readonly configured: boolean;
  readonly warnings: readonly string[];
}

/** Public configuration mutation; secret values are represented only by opaque refs. */
export interface SourceConfigureInput {
  readonly adapterId: string;
  readonly config: AdapterConfig;
}

/** User-confirmed source action before adapter-specific resource dispatch. */
export interface SourceActionInput {
  readonly selection: UserCollectionSelection;
  readonly subject: SubjectRef;
  readonly externalSubjectQuery?: string;
  readonly objective: string;
  readonly since?: IsoDateTime;
  readonly limit?: number;
}

/** Adapter preflight plus provider subject candidates for user confirmation. */
export interface SourcePreflightResult {
  readonly adapter: AdapterPreflightResult;
  readonly subjects: readonly ExternalSubjectRef[];
}

/** Count and authoritative ingest results produced by a completed collection. */
export interface SourceCollectResult {
  readonly materialCount: number;
  readonly ingestResults: readonly IngestResult[];
}

/** Direct-user collection method table kept separate from EngineMethodMap and MCP. */
export interface UserCollectionMethodMap {
  readonly "source.list": {
    readonly params: EmptyResult;
    readonly result: readonly SourceStatus[];
  };
  readonly "source.configure": {
    readonly params: SourceConfigureInput;
    readonly result: SourceStatus;
  };
  readonly "source.preflight": {
    readonly params: SourceActionInput;
    readonly result: SourcePreflightResult;
  };
  readonly "source.collect": {
    readonly params: SourceActionInput;
    readonly result: SourceCollectResult;
  };
}

export type SourceQueryActionName = "source.list";
export type SourceMutationActionName = Exclude<
  keyof UserCollectionMethodMap,
  SourceQueryActionName
>;

/** Actor-bound client used only by direct user CLI and Panel collection surfaces. */
export interface UserCollectionClient {
  call<M extends SourceQueryActionName>(
    method: M,
    params: UserCollectionMethodMap[M]["params"],
  ): Promise<UserCollectionMethodMap[M]["result"]>;
  call<M extends SourceMutationActionName>(
    method: M,
    params: UserCollectionMethodMap[M]["params"],
    context: { readonly requestId: RequestId },
  ): Promise<UserCollectionMethodMap[M]["result"]>;
}
