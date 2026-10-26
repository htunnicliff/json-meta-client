// oxlint-disable typescript/consistent-type-imports
declare namespace JMAP {
  export interface SessionCapabilities {
    "urn:ietf:params:jmap:core": {
      maxSizeUpload: number;
      maxConcurrentUpload: number;
      maxSizeRequest: number;
      maxConcurrentRequests: number;
      maxCallsInRequest: number;
      maxObjectsInGet: number;
      maxObjectsInSet: number;
      collationAlgorithms: string[];
    };
  }

  export interface AccountCapabilities {
    "urn:ietf:params:jmap:core": {};
  }

  export interface Session {
    capabilities: SessionCapabilities;
    accounts: { [id: string]: Account };
    primaryAccounts: { [urn: string]: string };
    username: string;
    apiUrl: string;
    downloadUrl: string;
    uploadUrl: string;
    eventSourceUrl: string;
    state: string;
    [key: string]: unknown;
  }

  export interface Account {
    name: string;
    isPersonal: boolean;
    isReadOnly: boolean;
    accountCapabilities: { [urn: string]: unknown };
  }

  export type Invocation<T = unknown> = [name: string, argsOrResponse: T, methodCallId: string];

  export interface Request {
    methodCalls: readonly Invocation[];
    using: readonly string[];
    createdIds?: Record<string, string>;
  }

  export interface Response {
    methodResponses: readonly Invocation[];
    sessionState: string;
    createdIds?: Record<string, string>;
  }

  export interface ResultReference {
    resultOf: string;
    name: string;
    path: string;
  }

  export interface ProblemDetails {
    type: string;
    status?: number;
    detail?: string;
    instance?: string;
    methodCallId?: string;
    limit?: string;
  }

  export interface GetArguments<T> {
    accountId: string;
    ids?: readonly string[];
    properties?: readonly (keyof T)[];
  }

  export interface GetResponse<T, Args extends GetArguments<T>> {
    accountId: string;
    state: string;
    list: ReadonlyArray<
      Args["properties"] extends ReadonlyArray<infer P extends keyof T> ? Pick<T, P> : T
    >;
    notFound: ReadonlyArray<string>;
  }

  export interface ChangesArguments {
    accountId: string;
    sinceState: string;
    maxChanges?: number;
  }

  export interface ChangesResponse {
    accountId: string;
    oldState: string;
    newState: string;
    hasMoreChanges: boolean;
    created: string[];
    updated: string[];
    destroyed: string[];
  }

  export type SetArguments<T extends object> = import("type-fest").RequireAtLeastOne<
    {
      accountId: string;
      ifInState?: string;
      create?: Record<string, import("type-fest").RequireAtLeastOne<T>>;
      update?: Record<string, PatchObject<T>>;
      destroy?: string[];
    },
    "create" | "update" | "destroy"
  >;

  export type PatchObject<T> = Partial<T> | Record<string, any>;

  export interface SetResponse<T extends object, Args extends SetArguments<T>> {
    accountId: string;
    oldState: string | null;
    newState: string;
    created: Args["create"] extends object ? { [K in keyof Args["create"]]?: T } : null;
    updated: Args["update"] extends object ? { [K in keyof Args["update"]]?: T | null } : null;
    destroyed: Args["destroy"] extends string[] ? string[] | null : null;
    notCreated: Args["create"] extends object
      ? { [K in keyof Args["create"]]?: SetError } | null
      : null;
    notUpdated: Args["update"] extends object
      ? { [K in keyof Args["update"]]?: SetError } | null
      : null;
    notDestroyed: Args["destroy"] extends string[] ? Record<string, SetError> | null : null;
  }

  export interface SetError<T extends Obj = Obj> {
    type: string;
    description: string | null;
    properties?: ReadonlyArray<keyof T>;
    existingId?: string;
  }

  export interface CopyArguments<T extends { id: string }> {
    fromAccountId: string;
    ifFromInState?: string;
    accountId: string;
    ifInState?: string;
    create: Record<string, T>;
    onSuccessDestroyOriginal?: boolean;
    destroyFromIfInState?: string;
  }

  export interface CopyResponse<T> {
    fromAccountId: string;
    accountId: string;
    oldState: string | null;
    newState: string;
    created: Record<string, T> | null;
    notCreated: Record<string, CopySetError> | null;
  }

  export type CopySetError<T extends Obj = Obj> = import("type-fest").Except<
    SetError<T>,
    "type"
  > & {
    type: SetError<T>["type"];
  };

  export interface QueryArguments<T extends Obj, Filter extends Obj = T> {
    accountId: string;
    filter?: FilterOperator<Filter> | FilterCondition<Filter>;
    sort?: ReadonlyArray<Comparator<T>>;
    position?: number;
    anchor?: string;
    anchorOffset?: number;
    limit?: number;
    calculateTotal?: boolean;
  }

  export interface QueryResponse {
    accountId: string;
    queryState: string;
    canCalculateChanges: boolean;
    position: number;
    ids: string[];
    total?: number;
    limit?: number;
  }

  export interface QueryChangesArguments<T extends Obj, Filter extends Obj> {
    accountId: string;
    filter?: FilterOperator<Filter> | FilterCondition<Filter>;
    sort?: ReadonlyArray<Comparator<T>>;
    sinceQueryState: string;
    maxChanges?: number;
    upToId?: string;
    calculateTotal?: boolean;
  }

  export interface QueryChangesResponse {
    accountId: string;
    oldQueryState: string;
    newQueryState: string;
    total?: number;
    removed: string[];
    added: ReadonlyArray<{
      id: string;
      index: number;
    }>;
  }

  export interface FilterOperator<Filter extends Obj> {
    operator: "AND" | "OR" | "NOT";
    conditions: ReadonlyArray<FilterOperator<Filter> | FilterCondition<Filter>>;
  }

  export type FilterCondition<Filter extends Obj> = import("type-fest").Except<
    Partial<Filter>,
    "operator"
  >;

  export interface Comparator<T extends Obj> {
    property: keyof T;
    isAscending?: boolean;
    collation?: string;
  }

  export interface BlobUploadParams {
    accountId: string;
  }

  export interface BlobUploadResponse {
    accountId: string;
    blobId: string;
    type: string;
    size: number;
  }

  export interface BlobDownloadParams {
    accountId: string;
    blobId: string;
    type: string;
    name: string;
  }

  export interface BlobCopyArguments {
    fromAccountId: string;
    accountId: string;
    blobIds: string[];
  }

  export interface BlobCopyResponse {
    fromAccountId: string;
    accountId: string;
    copied: Record<string, string> | null;
    notCopied: Record<string, BlobCopySetError> | null;
  }

  export type BlobCopySetError<T extends Obj = Obj> = import("type-fest").Except<
    SetError<T>,
    "type"
  > & {
    type: SetError<T>["type"];
  };

  export interface StateChange {
    "@type": "StateChange";
    changed: Record<string, Record<string, string>>;
  }

  export interface PushSubscriptionCreate {
    deviceClientId: string;
    url: string;
    keys?: {
      p256dh: string;
      auth: string;
    };
    verificationCode?: string;
    expires?: string;
    types?: string[];
  }

  export interface PushSubscription extends PushSubscriptionCreate {
    id: string;
  }

  export interface PushVerification {
    "@type": "PushVerification";
    pushSubscriptionId: string;
    verificationCode: string;
  }

  export interface EventSourceArguments {
    types: string;
    closeafter: "state" | "no";
    ping: string;
  }

  type Obj = Record<string, unknown>;
}
