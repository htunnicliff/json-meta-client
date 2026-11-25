// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { UnionToIntersection } from "type-fest";

import type {
  BUILT_IN_CAPABILITIES,
  BuiltInCapabilityName,
  DefaultCapabilities,
} from "./built-ins.ts";
import type {
  Capability,
  InferContractExtensions,
  InferMethodsFromCapability,
} from "./capability.ts";
import type { JsonMetaError, StateChangeError } from "./errors/index.ts";
import type { Augment, MarkDefaultAccounts } from "./internal/types.ts";
import type {
  Request as JmapRequest,
  Response as JmapResponse,
  Session as JmapSession,
} from "./rfc-types/core/index.ts";
import type { TransportFactory } from "./transports/types.ts";

/** Mutate the outgoing request before request hooks; async callbacks are awaited. */
export type AuthCallback = (args: { request: Request }) => void | Promise<void>;

/**
 * Bearer token string, Basic credentials, or a custom callback. It is applied
 * to every HTTP request. A WebSocket transport receives the resulting headers
 * when it opens a socket, but a browser's `WebSocket` can't send them.
 */
export type Auth = AuthCallback | string | { username: string; password: string };

export interface Config<T extends ReadonlyArray<CapabilityOption>> {
  /**
   * Authentication applied before request hooks, including event-stream reconnects
   */
  auth: Auth;
  /**
   * The URI for getting a JMAP session
   */
  sessionUrl: string | URL;
  /**
   * Capabilities used by the client
   */
  capabilities: T;
  /**
   * Synchronously generate an ID from a JMAP method name such as `Email/get`.
   * Called only when the method call omits its explicit ID. IDs must be
   * unique within a request. Defaults to the method name plus eight random
   * hex digits, separated by `::`.
   */
  generateMethodCallId?: (method: string) => string;
  /**
   * Creates the transport that carries JMAP Requests, and push messages when
   * it supports them. Defaults to `httpTransport()`. Use
   * `webSocketTransport()` for the JMAP WebSocket subprotocol.
   */
  transport?: TransportFactory;
  /**
   * Receives problems the client can work around, such as configured
   * capabilities that the server doesn't advertise. Defaults to
   * `console.warn`. Pass a no-op function to silence warnings.
   */
  onWarning?: (warning: JsonMetaError) => void;
  /**
   * Hooks into different client behaviors
   */
  hooks?: {
    /** Transform each authenticated HTTP request, including stream reconnects. */
    beforeFetch?: ReadonlyArray<BeforeFetchHook>;
    /** Transform each HTTP response before status validation or body parsing. */
    afterFetch?: ReadonlyArray<AfterFetchHook>;
    /** Transform the complete batch before serialization. */
    beforeJmapRequest?: ReadonlyArray<BeforeJmapRequestHook>;
    /** Transform the parsed envelope before resolving individual method calls. */
    afterJmapResponse?: ReadonlyArray<AfterJmapResponseHook>;
    /** Transform each stream connection request after beforeFetch. */
    beforeEventSourceConnect?: ReadonlyArray<BeforeEventSourceConnectHook>;
    /** Observe each validated stream connection before reading any messages. */
    afterEventSourceConnect?: ReadonlyArray<AfterEventSourceConnectHook>;
  };
}

//#region hook-before-fetch
export interface BeforeFetchHook {
  (params: { httpRequest: Request }): Request | Promise<Request>;
}
//#endregion

//#region hook-after-fetch
export interface AfterFetchHook {
  (params: { httpRequest: Request; httpResponse: Response }): Response | Promise<Response>;
}
//#endregion

//#region hook-before-jmap-request
export interface BeforeJmapRequestHook {
  (params: { jmapRequest: JmapRequest }): JmapRequest | Promise<JmapRequest>;
}
//#endregion

//#region hook-after-jmap-response
export interface AfterJmapResponseHook {
  (params: {
    jmapRequest: JmapRequest;
    jmapResponse: JmapResponse;
  }): JmapResponse | Promise<JmapResponse>;
}
//#endregion

//#region hook-before-event-source-connect
export type BeforeEventSourceConnectHook = BeforeFetchHook;
//#endregion

//#region hook-after-event-source-connect
/** Observe headers only; leave the response body available for streaming. */
export interface AfterEventSourceConnectHook {
  (params: { httpRequest: Request; httpResponse: Response }): void | Promise<void>;
}
//#endregion

export type CapabilityOption = Capability | BuiltInCapabilityName;

export type ResolveCapability<C> = C extends BuiltInCapabilityName
  ? (typeof BUILT_IN_CAPABILITIES)[C]
  : C;

export type ClientApi<T extends ReadonlyArray<CapabilityOption>> = T[number] extends never
  ? object
  : Augment<
      UnionToIntersection<CapabilityMethodsWithDefaults<ResolveCapability<T[number]>>>,
      ClientContractExtensions<T>
    >;

/**
 * A capability's methods, each marked when the capability gives its calls
 * no default `accountId`. Marked before the client merges every
 * capability's methods, which loses the capability each method came from.
 */
type CapabilityMethodsWithDefaults<C> = C extends unknown
  ? MarkDefaultAccounts<InferMethodsFromCapability<C>, InferDefaultAccountSetting<C>>
  : never;

/** A capability's `defaultAccount` setting, or `undefined` when it omits one. */
type InferDefaultAccountSetting<C> = C extends { defaultAccount?: infer Setting }
  ? [Exclude<Setting, undefined>] extends [never]
    ? undefined
    : Exclude<Setting, undefined>
  : undefined;

/** The contract extensions contributed by every configured capability. */
type ClientContractExtensions<T extends ReadonlyArray<CapabilityOption>> =
  InferContractExtensions<ResolveCapability<T[number]>> extends infer Extensions
    ? [Extensions] extends [never]
      ? unknown
      : UnionToIntersection<Extensions>
    : never;

type ResolvedClientCapability<T extends ReadonlyArray<CapabilityOption>> =
  | ResolveCapability<T[number]>
  | DefaultCapabilities[number];

type AccountCapabilityDetails<C> = UnionToIntersection<
  C extends Capability<
    infer _Entity,
    infer _Methods,
    infer Urn,
    infer AccountCapabilities,
    infer _SessionCapabilities
  >
    ? Record<Urn, AccountCapabilities>
    : never
>;

type SessionCapabilityDetails<C> = UnionToIntersection<
  C extends Capability<
    infer _Entity,
    infer _Methods,
    infer Urn,
    infer _AccountCapabilities,
    infer SessionCapabilities
  >
    ? Record<Urn, SessionCapabilities>
    : never
>;

type JmapAccount = JmapSession["accounts"][string];

/**
 * A JMAP session augmented with the capability details configured for a client.
 * Configured capabilities may be absent from the server or an individual account.
 */
export type ClientSession<T extends ReadonlyArray<CapabilityOption>> = JmapSession & {
  capabilities: Partial<SessionCapabilityDetails<ResolvedClientCapability<T>>>;
  accounts: {
    [accountId: string]: JmapAccount & {
      accountCapabilities: Partial<AccountCapabilityDetails<ResolvedClientCapability<T>>>;
    };
  };
};

export interface StateChangePayload {
  /** The account that the change occurred in  */
  accountId: string;
  /**
   * Whether an `Entity/get` call for the changed entity that passes no
   * `accountId` would go to this account: the default account of the
   * capability that owns the call. With different primary accounts for mail
   * and contacts, an `Email` change is primary in one and a `ContactCard`
   * change in the other.
   *
   * A type with no such call to resolve, such as the push-only
   * `EmailDelivery`, is primary in an account that is the primary account of
   * any configured capability, or that is the session's only account.
   *
   * It is `false` when the session leaves the default account ambiguous.
   */
  isPrimaryAccount: boolean;
  /** The type of entity that saw a change */
  entity: string;
  /** An opaque object-state cursor for the changed entity's `{Entity}/changes` method  */
  state: string;
}

export type OnStateChangeHandler = (
  ...params:
    | [error: null, change: StateChangePayload]
    | [error: StateChangeError, change: undefined]
) => void;

export interface OnStateChangeOptions {
  /** An abort signal that ends this subscription */
  signal?: AbortSignal;
  /**
   * An interval in seconds to request that the server send pings. Applies
   * only to the event stream; a WebSocket push channel sends its own
   * heartbeat, set with `heartbeatSeconds` on `webSocketTransport()`.
   */
  pingSeconds?: number;
}
