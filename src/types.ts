import type { SetOptional } from "type-fest";

import type { AllowRefs } from "./ref.ts";

export type OptionalAccountId<Args> = Args extends { accountId: unknown }
  ? SetOptional<Args, "accountId">
  : Args;

/** Allow a result reference in place of any argument value (including nested). */
export type AllowRefsInArgs<Args> = {
  [K in keyof Args]: AllowRefs<Args[K]>;
};
