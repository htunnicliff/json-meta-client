import type { SetOptional } from "type-fest";

import type { BatchResult } from "./batcher.ts";
import type { MethodCall } from "./method-calls.ts";
import type { AllowRefs, UnpackRefs } from "./ref.ts";

export type OptionalAccountId<Args> = Args extends { accountId: unknown }
  ? SetOptional<Args, "accountId">
  : Args;

/** Allow a result reference in place of any argument value (including nested). */
export type AllowRefsInArgs<Args> = {
  [K in keyof Args]: AllowRefs<Args[K]>;
};

/**
 * Client-proxy shape for methods whose result does not depend on the concrete
 * argument type. Uses `const A` so call-site literals and {@link AllowRefs}
 * still infer.
 */
export type ClientMethod<Args, Result> = <const A extends OptionalAccountId<AllowRefsInArgs<Args>>>(
  args: A,
) => BatchResult<MethodCall<UnpackRefs<A>>, Result>;
