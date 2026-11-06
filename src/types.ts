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
import type { Session as JmapSession } from "./rfc-types/core/index.ts";

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
    /**
     * These hooks run in order after authentication, including event-stream reconnects.
     * Each returned {@link Request} is passed to the next hook and then fetched.
     */
    beforeRequest?: ReadonlyArray<BeforeRequestHook>;
    /**
     * These hooks are called with every {@link Response} received after fetching
     */
    afterResponse?: ReadonlyArray<AfterResponseHook>;
  };
}

export type BeforeRequestHook = (params: { request: Request }) => Request | Promise<Request>;

export type AfterResponseHook = (params: {
  request: Request;
  response: Response;
}) => Response | Promise<Response>;

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
