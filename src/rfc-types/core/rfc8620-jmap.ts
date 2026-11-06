/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { AccountCapabilities, SessionCapabilities } from "../extensions.ts";

declare module "../extensions.ts" {
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
}

/**
 * @see https://www.rfc-editor.org/info/rfc8620/#section-2
 */
export interface Session {
  capabilities: Partial<SessionCapabilities> &
    Pick<SessionCapabilities, "urn:ietf:params:jmap:core"> & {
      [uri: string]: object;
    };
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

/**
 * @see https://www.rfc-editor.org/info/rfc8620/#section-2
 */
export interface Account {
  name: string;
  isPersonal: boolean;
  isReadOnly: boolean;
  accountCapabilities: Partial<AccountCapabilities> & { [uri: string]: object };
}

/**
 * @see https://www.rfc-editor.org/info/rfc8620/#section-3.2
 */
export type Invocation<T extends object = object> = [
  name: string,
  argsOrResponse: T,
  methodCallId: string,
];

/** @see https://www.rfc-editor.org/info/rfc8620/#section-3.3 */
export interface Request {
  methodCalls: readonly Invocation[];
  using: readonly string[];
  createdIds?: Record<string, string>;
}

/** @see https://www.rfc-editor.org/info/rfc8620/#section-3.4 */
export interface Response {
  methodResponses: readonly Invocation[];
  sessionState: string;
  createdIds?: Record<string, string>;
}

/** @see https://www.rfc-editor.org/info/rfc8620/#section-3.7 */
export interface ResultReference {
  resultOf: string;
  name: string;
  path: string;
}

/** @see https://www.rfc-editor.org/info/rfc8620/#section-3.6 */
export interface ProblemDetails {
  type: string;
  title?: string;
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
> = Args extends { properties: readonly (infer P)[] }
  ? Pick<T, Extract<P, keyof T>>
  : Pick<T, Options["defaultProperties"]>;

export namespace MethodGet {
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-5.1 */
  export interface Input<T> {
    accountId: string;
    ids?: readonly string[] | null;
    properties?: readonly (keyof T)[] | null;
  }

  export interface Output<T, Args> {
    accountId: string;
    state: string;
    list: ReadonlyArray<Pick<T, Extract<keyof PickPropertiesForEntity<T, Args> | "id", keyof T>>>;
    notFound: ReadonlyArray<string>;
  }

  export interface Contract<T> {
    input: Input<T>;
    output: Output<T, this["input"]>;
  }
}

export namespace MethodChanges {
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-5.2 */
  export interface Input {
    accountId: string;
    sinceState: string;
    maxChanges?: number | null;
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

/** Escape one JSON Pointer segment (RFC 6901). */
export type EscapePatchKey<Key extends string> = Key extends `${infer Head}~${infer Tail}`
  ? `${EscapePatchKey<Head>}~0${EscapePatchKey<Tail>}`
  : Key extends `${infer Head}/${infer Tail}`
    ? `${EscapePatchKey<Head>}~1${EscapePatchKey<Tail>}`
    : Key;

type PatchEntry<T, Depth extends readonly unknown[] = []> = Depth["length"] extends 8
  ? never
  : T extends object
    ? {
        [Key in keyof T & string]:
          | [EscapePatchKey<Key>, Exclude<T[Key], undefined> extends never ? never : T[Key] | null]
          | (NonNullable<T[Key]> extends readonly unknown[]
              ? never
              : PatchEntry<NonNullable<T[Key]>, [...Depth, unknown]> extends infer Child
                ? Child extends [infer Path extends string, infer Value]
                  ? [`${EscapePatchKey<Key>}/${Path}`, Value]
                  : never
                : never);
      }[keyof T & string]
    : never;

/** Replacements and object paths; null removes a property. Arrays are atomic. */
export type PatchObject<T> = {
  [Entry in PatchEntry<T> as Entry[0]]?: Entry[1];
};

export namespace MethodSet {
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-5.3 */
  export interface Input<
    T extends object,
    Create extends object = Omit<T, "id">,
    Update extends object = Omit<T, "id">,
  > {
    accountId: string;
    ifInState?: string | null;
    create?: Record<string, Create> | null;
    update?: Record<string, PatchObject<Update>> | null;
    destroy?: string[] | null;
  }

  export interface Output<T extends object, Created extends object = Partial<T> & { id: string }> {
    accountId: string;
    oldState?: string | null;
    newState: string;
    created?: Record<string, Created> | null;
    updated?: Record<string, Partial<T> | null> | null;
    destroyed?: string[] | null;
    notCreated?: Record<string, SetError> | null;
    notUpdated?: Record<string, SetError> | null;
    notDestroyed?: Record<string, SetError> | null;
  }
}

export interface SetError {
  type: string;
  description?: string | null;
  properties?: ReadonlyArray<string>;
  existingId?: string;
}

export namespace MethodCopy {
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-5.4 */
  export interface Input<T extends { id: string }> {
    fromAccountId: string;
    ifFromInState?: string | null;
    accountId: string;
    ifInState?: string | null;
    create: Record<string, Pick<T, "id"> & Partial<Omit<T, "id">>>;
    onSuccessDestroyOriginal?: boolean;
    destroyFromIfInState?: string | null;
  }

  export interface Output<T, Created extends object = Partial<T> & { id: string }> {
    fromAccountId: string;
    accountId: string;
    oldState?: string | null;
    newState: string;
    created?: Record<string, Created> | null;
    notCreated?: Record<string, SetError> | null;
  }

  export interface Contract<T extends { id: string }> {
    input: Input<T>;
    output: Output<T>;
  }
}

export namespace MethodQuery {
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-5.5 */
  export interface Input<T extends object, Filter extends object = T> {
    accountId: string;
    filter?: FilterOperator<Filter> | FilterCondition<Filter> | null;
    sort?: ReadonlyArray<Comparator<T>> | null;
    position?: number;
    anchor?: string | null;
    anchorOffset?: number;
    limit?: number | null;
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
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-5.6 */
  export interface Input<T extends object, Filter extends object> {
    accountId: string;
    filter?: FilterOperator<Filter> | FilterCondition<Filter> | null;
    sort?: ReadonlyArray<Comparator<T>> | null;
    sinceQueryState: string;
    maxChanges?: number | null;
    upToId?: string | null;
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
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-6.1 */
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
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-6.2 */
  export interface Params {
    accountId: string;
    blobId: string;
    type: string;
    name: string;
  }
}

export namespace CoreEcho {
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-4 */
  export interface Contract {
    input: Record<string, unknown>;
    output: this["input"];
  }
}

export namespace BlobCopy {
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-6.3 */
  export interface Input {
    fromAccountId: string;
    accountId: string;
    blobIds: string[];
  }

  export interface Output {
    fromAccountId: string;
    accountId: string;
    copied?: Record<string, string> | null;
    notCopied?: Record<string, SetError> | null;
  }

  export interface Contract {
    input: Input;
    output: Output;
  }
}

export interface TypeState {
  [type: string]: string;
}

/** @see https://www.rfc-editor.org/info/rfc8620/#section-7.1 */
export interface StateChange {
  "@type": "StateChange";
  changed: {
    [accountId: string]: TypeState;
  };
}

export namespace PushSubscriptionGet {
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-7.2.1 */
  export interface Contract {
    input: Omit<MethodGet.Input<PushSubscription>, "accountId">;
    output: Omit<MethodGet.Output<PushSubscription, this["input"]>, "accountId" | "state">;
  }
}

export namespace PushSubscriptionSet {
  /** @see https://www.rfc-editor.org/info/rfc8620/#section-7.2.2 */
  export interface Input extends Omit<
    MethodSet.Input<
      PushSubscription,
      PushSubscriptionCreate,
      Pick<PushSubscription, "verificationCode" | "expires" | "types">
    >,
    "accountId" | "ifInState"
  > {}

  export interface Output extends Omit<
    MethodSet.Output<PushSubscription>,
    "accountId" | "oldState" | "newState"
  > {}

  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8620/#section-7.2 */
export interface PushSubscription {
  id: string;
  deviceClientId: string;
  verificationCode?: string | null;
  expires?: string | null;
  types?: string[] | null;
}

export interface PushSubscriptionCreate extends Omit<PushSubscription, "id" | "verificationCode"> {
  id?: never;
  verificationCode?: null;
  url: string;
  keys?: {
    p256dh: string;
    auth: string;
  } | null;
}

/** @see https://www.rfc-editor.org/info/rfc8620/#section-7.2 */
export interface PushVerification {
  "@type": "PushVerification";
  pushSubscriptionId: string;
  verificationCode: string;
}

/** @see https://www.rfc-editor.org/info/rfc8620/#section-7.3 */
export interface EventSourceArguments {
  types: string;
  closeafter: "state" | "no";
  ping: number;
}
