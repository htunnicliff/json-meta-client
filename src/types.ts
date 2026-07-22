import type { SetOptional } from "type-fest";

import type { BatchResult } from "./batcher.ts";
import type { MethodCall } from "./method-calls.ts";
import type { AllowRefs } from "./ref.ts";

export interface GlobalMethodCalls {
  //
}

export type GlobalEntity = keyof GlobalMethodCalls;

type OptionalAccountId<Args> = Args extends { accountId: unknown }
  ? SetOptional<Args, "accountId">
  : Args;

/** Allow a result reference in place of any argument value (including nested). */
type AllowRefsInArgs<Args> = {
  [K in keyof Args]: AllowRefs<Args[K]>;
};

/**
 * The asynchronous, promise-returning view of {@link GlobalMethodCalls} exposed
 * by the client proxy. Every method accepts its usual arguments (or result
 * references resolving to those types) and returns a promise of its result,
 * since calls are dispatched over the network.
 *
 * Only entities unlocked by the client's configured capabilities appear.
 */
export type Api = {
  [E in GlobalEntity]: {
    [Method in keyof GlobalMethodCalls[E]]: GlobalMethodCalls[E][Method] extends (
      args: infer Args,
    ) => infer Result
      ? (
          args: OptionalAccountId<AllowRefsInArgs<Args>>,
        ) => BatchResult<MethodCall<Args>, Result>
      : never;
  };
};
