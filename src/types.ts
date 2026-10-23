import type { UnionToIntersection } from "type-fest";

import type { BUILT_IN_CAPABILITIES, BuiltInCapabilityName } from "./built-ins.ts";
import type { Capability, InferMethodsFromCapability } from "./capability.ts";
import type { StateChangeError } from "./errors.ts";
import type { Augment, Middleware } from "./internal/types.ts";

export interface Config<T extends ReadonlyArray<CapabilityOption>> {
  /**
   * A valid bearer token
   */
  bearerToken: string;
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
     * These hooks are called with every {@link Request} prior to fetching
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
