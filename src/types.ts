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
import type { Capability, InferMethodsFromCapability } from "./capability.ts";
import type { StateChangeError } from "./errors.ts";
import type { Augment, Middleware } from "./internal/types.ts";
import type {
  Request as JmapRequest,
  Response as JmapResponse,
  Session as JmapSession,
} from "./rfc-types/core/index.ts";

/** Mutate the outgoing request before request hooks; async callbacks are awaited. */
export type AuthCallback = (args: { request: Request }) => void | Promise<void>;

/** Bearer, Basic, or custom authentication for every transport. */
export type Auth =
  | AuthCallback
  | { token: string; username?: never; password?: never }
  | { username: string; password: string; token?: never };

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
   * UNSTABLE: Functions for intercepting and modifying a JMAP request
   */
  middleware?: ReadonlyArray<Middleware>;
  /**
   * Hooks into different client behaviors
   */
  hooks?: {
    /** Transform each authenticated HTTP request, including stream reconnects. */
    beforeFetch?: ReadonlyArray<BeforeFetchHook>;
    /** Transform each HTTP response before status validation or body parsing. */
    afterFetch?: ReadonlyArray<AfterFetchHook>;
    /** Transform the complete batch after middleware and before serialization. */
    beforeJmapRequest?: ReadonlyArray<BeforeJmapRequestHook>;
    /** Transform the parsed envelope before resolving individual method calls. */
    afterJmapResponse?: ReadonlyArray<AfterJmapResponseHook>;
    /** Transform each stream connection request after beforeFetch. */
    beforeEventSourceConnect?: ReadonlyArray<BeforeEventSourceConnectHook>;
    /** Observe each validated stream connection before reading any messages. */
    afterEventSourceConnect?: ReadonlyArray<AfterEventSourceConnectHook>;
    /**
     * @deprecated Use beforeFetch. Runs before beforeFetch when both are configured.
     */
    beforeRequest?: ReadonlyArray<BeforeRequestHook>;
    /**
     * @deprecated Use afterFetch. Runs before afterFetch when both are configured.
     */
    afterResponse?: ReadonlyArray<AfterResponseHook>;
  };
}

export type BeforeFetchHook = (params: { request: Request }) => Request | Promise<Request>;

export type AfterFetchHook = (params: {
  request: Request;
  response: Response;
}) => Response | Promise<Response>;

export type BeforeJmapRequestHook = (params: {
  request: JmapRequest;
}) => JmapRequest | Promise<JmapRequest>;

export type AfterJmapResponseHook = (params: {
  request: JmapRequest;
  response: JmapResponse;
}) => JmapResponse | Promise<JmapResponse>;

export type BeforeEventSourceConnectHook = BeforeFetchHook;

/** Observe headers only; leave the response body available for streaming. */
export type AfterEventSourceConnectHook = (params: {
  request: Request;
  response: Response;
}) => void | Promise<void>;

/** @deprecated Use BeforeFetchHook. */
export type BeforeRequestHook = BeforeFetchHook;

/** @deprecated Use AfterFetchHook. */
export type AfterResponseHook = AfterFetchHook;

export type CapabilityOption = Capability | BuiltInCapabilityName;

export type ResolveCapability<C> = C extends BuiltInCapabilityName
  ? (typeof BUILT_IN_CAPABILITIES)[C]
  : C;

export type ClientApi<T extends ReadonlyArray<CapabilityOption>> = T[number] extends never
  ? object
  : Augment<UnionToIntersection<InferMethodsFromCapability<ResolveCapability<T[number]>>>>;

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
  /** Whether the account ID is that of the primary account */
  isPrimaryAccount: boolean;
  /** The type of entity that saw a change */
  entity: string;
  /** An opaque string that can be passed to `{Entity}/queryChanges`  */
  state: string;
}

export type OnStateChangeHandler = (
  ...params:
    | [error: null, change: StateChangePayload]
    | [error: StateChangeError, change: undefined]
) => void;

export interface OnStateChangeOptions {
  /** An abort signal that can terminate the event source */
  signal?: AbortSignal;
  /** An interval in seconds to request that the server send pings */
  pingSeconds?: number;
}
