declare module "./index.ts" {
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

  export type PickPropertiesForEntity<
    T,
    Args,
    Options extends {
      defaultProperties: keyof T;
    } = {
      defaultProperties: keyof T;
    },
  > = Args extends { properties?: readonly string[] }
    ? ["properties"] extends ReadonlyArray<infer P extends keyof T>
      ? Pick<T, P>
      : Pick<T, Options["defaultProperties"]>
    : never;

  export namespace MethodGet {
    export interface Input<T> {
      accountId: string;
      ids?: readonly string[];
      properties?: readonly (keyof T)[];
    }

    export interface Output<T, Args> {
      accountId: string;
      state: string;
      list: ReadonlyArray<PickPropertiesForEntity<Args, T>>;
      notFound: ReadonlyArray<string>;
    }

    export interface Contract<T> {
      input: Input<T>;
      output: Output<T, this["input"]>;
    }
  }

  export namespace MethodChanges {
    export interface Input {
      accountId: string;
      sinceState: string;
      maxChanges?: number;
    }

    export interface Output {
      accountId: string;
      oldState: string;
      newState: string;
      hasMoreChanges: boolean;
      created: string[];
      updated: string[];
      destroyed: string[];
    }
  }

  export type PatchObject<T> = Partial<T> | Record<string, any>;

  export namespace MethodSet {
    export interface Input<T extends object> {
      accountId: string;
      ifInState?: string;
      create?: Record<string, T>;
      update?: Record<string, PatchObject<T>>;
      destroy?: string[];
    }

    export interface Output<T extends object> {
      accountId: string;
      oldState: string | null;
      newState: string;
      created: Record<string, T> | null;
      updated: Record<string, T | null> | null;
      destroyed: string[] | null;
      notCreated: Record<string, SetError> | null;
      notUpdated: Record<string, SetError> | null;
      notDestroyed: Record<string, SetError> | null;
    }
  }

  export interface SetError<T = object> {
    type: string;
    description: string | null;
    properties?: ReadonlyArray<keyof T>;
    existingId?: string;
  }

  export namespace MethodCopy {
    export interface Input<T extends { id: string }> {
      fromAccountId: string;
      ifFromInState?: string;
      accountId: string;
      ifInState?: string;
      create: Record<string, T>;
      onSuccessDestroyOriginal?: boolean;
      destroyFromIfInState?: string;
    }

    export interface Output<T> {
      fromAccountId: string;
      accountId: string;
      oldState: string | null;
      newState: string;
      created: Record<string, T> | null;
      notCreated: Record<string, SetError> | null;
    }

    export interface Contract<T extends { id: string }> {
      input: Input<T>;
      output: Output<this["input"]>;
    }
  }

  export namespace MethodQuery {
    export interface Input<T extends object, Filter extends object = T> {
      accountId: string;
      filter?: FilterOperator<Filter> | FilterCondition<Filter>;
      sort?: ReadonlyArray<Comparator<T>>;
      position?: number;
      anchor?: string;
      anchorOffset?: number;
      limit?: number;
      calculateTotal?: boolean;
    }

    export interface Output {
      accountId: string;
      queryState: string;
      canCalculateChanges: boolean;
      position: number;
      ids: string[];
      total?: number;
      limit?: number;
    }

    export interface Contract<T extends object, Filter extends object = T> {
      input: Input<T, Filter>;
      output: Output;
    }
  }

  export namespace MethodQueryChanges {
    export interface Input<T extends object, Filter extends object> {
      accountId: string;
      filter?: FilterOperator<Filter> | FilterCondition<Filter>;
      sort?: ReadonlyArray<Comparator<T>>;
      sinceQueryState: string;
      maxChanges?: number;
      upToId?: string;
      calculateTotal?: boolean;
    }

    export interface Output {
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

    export interface Contract<T extends object, Filter extends object = T> {
      input: Input<T, Filter>;
      output: Output;
    }
  }

  export type FilterCondition<Filter> = Partial<Filter>;

  export interface FilterOperator<Filter> {
    operator: "AND" | "OR" | "NOT";
    conditions: ReadonlyArray<FilterOperator<Filter> | FilterCondition<Filter>>;
  }

  export interface Comparator<T extends object> {
    property: keyof T;
    isAscending?: boolean;
    collation?: string;
  }

  export namespace FileUpload {
    export interface Params {
      accountId: string;
    }

    export interface Result {
      accountId: string;
      blobId: string;
      type: string;
      size: number;
    }
  }

  export namespace FileDownload {
    export interface Params {
      accountId: string;
      blobId: string;
      type: string;
      name: string;
    }
  }

  export namespace CoreEcho {
    export interface Contract {
      input: any;
      output: this["input"];
    }
  }

  export namespace BlobCopy {
    export interface Input {
      fromAccountId: string;
      accountId: string;
      blobIds: string[];
    }

    export interface Output {
      fromAccountId: string;
      accountId: string;
      copied: Record<string, string> | null;
      notCopied: Record<string, SetError> | null;
    }

    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface TypeState {
    [type: string]: string;
  }

  export interface StateChange {
    "@type": "StateChange";
    changed: {
      [accountId: string]: TypeState;
    };
  }

  export namespace PushSubscriptionGet {
    export interface Contract {
      input: Omit<MethodGet.Input<PushSubscription>, "accountId">;
      output: MethodGet.Output<PushSubscription, this["input"]>;
    }
  }

  export namespace PushSubscriptionSet {
    export interface Input {
      accountId: string;
      ifInState?: string;
      create?: Record<string, PushSubscriptionCreate>;
      update?: Record<string, PatchObject<PushSubscription>>;
      destroy?: string[];
    }

    export interface Output {
      accountId: string;
      oldState: string | null;
      newState: string;
      created: Record<string, PushSubscription> | null;
      updated: Record<string, PushSubscription | null> | null;
      destroyed: string[] | null;
      notCreated: Record<string, SetError> | null;
      notUpdated: Record<string, SetError> | null;
      notDestroyed: Record<string, SetError> | null;
    }

    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface PushSubscription {
    id: string;
    deviceClientId: string;
    verificationCode?: string;
    expires?: string;
    types?: string[];
  }

  export interface PushSubscriptionCreate extends PushSubscription {
    url: string;
    keys?: {
      p256dh: string;
      auth: string;
    };
  }

  export interface PushVerification {
    "@type": "PushVerification";
    pushSubscriptionId: string;
    verificationCode: string;
  }

  export interface EventSourceArguments {
    types: string;
    closeafter: "state" | "no";
    ping: number;
  }
}
