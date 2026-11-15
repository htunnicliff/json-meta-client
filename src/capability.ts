// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { CapabilityMethods, ConfigurableCapability } from "./internal/types.ts";

export interface MethodContract {
  input: unknown;
  output: unknown;
}

/**
 * Where the client finds the `accountId` it adds to a method call that
 * doesn't pass one:
 * - `"primary"`: the account the session lists for the capability's URN in
 *   `primaryAccounts`. If the session lists none, the call is sent without
 *   `accountId`.
 * - `null`: no default. Callers must pass `accountId`.
 */
export type DefaultAccount = "primary" | null;

/**
 * Which method calls a capability gives a default `accountId`, keyed by
 * method name (`Entity/method`) or `"*"`.
 *
 * A listed method name claims that method call for the capability. `"*"`
 * claims every other method on the capability's entities. When a capability
 * omits the setting, it claims every method as `{ "*": "primary" }` would; a
 * setting without `"*"` claims only the methods it lists.
 *
 * A method set to `null` is still claimed: the client adds no `accountId`,
 * even if another capability declares the same entity. A method that is left
 * out falls through to `"*"`, or, without `"*"`, to whichever capability
 * claims it, if any.
 *
 * Two capabilities can't claim the same method call with different settings:
 * the client throws a `CapabilityConfigurationError` when it is constructed.
 */
export type DefaultAccountSetting<Name extends string = string> = {
  "*"?: DefaultAccount;
} & { [Key in Name]?: DefaultAccount };

/**
 * A fully configured capability:
 * - Known entities (type and value)
 * - Known urn (value)
 * - Other URNs its methods need in a request's `using` array (value)
 * - Known methods (type)
 * - Known account capability details (type)
 * - Known session capability details (type)
 * - Which method calls get a default `accountId` (type and value)
 */
export interface Capability<
  Entity extends string = string,
  _Methods extends CapabilityMethods<Entity> = CapabilityMethods<Entity>,
  Urn extends string = string,
  _AccountCapabilities = unknown,
  _SessionCapabilities = unknown,
  DefaultAccounts extends DefaultAccountSetting | undefined = DefaultAccountSetting | undefined,
> {
  urn: Urn;
  entities: ReadonlyArray<Entity>;
  /**
   * Other capability URNs that the server needs in a request's `using`
   * array when calling this capability's methods. The client adds them
   * alongside {@link Capability.urn}.
   */
  dependsOn?: ReadonlyArray<string>;
  /**
   * Which method calls get a default `accountId`, and where it comes from.
   * Omitted, every method on the capability's entities defaults to the
   * session's primary account for {@link Capability.urn}.
   *
   * @see {@link DefaultAccountSetting}
   */
  defaultAccount?: DefaultAccounts;
}

/**
 * Extracts the {@link CapabilityMethods} from a configured
 * {@link Capability}
 */
export type InferMethodsFromCapability<C> =
  C extends Capability<infer _Entity, infer Methods> ? Methods : never;

/**
 * Define a JMAP capability for one or more entities
 *
 * @example
 * ```ts
 * import { defineCapability } from "json-meta-client";
 *
 * const notes = defineCapability({
 *   urn: "urn:example:notes",
 *   entities: ["Note"],
 * }).withMethods<{
 *   Note: { get: { input: { ids: string[] }; output: { ids: string[] } } };
 * }>();
 * ```
 */
export function defineCapability<
  const Entity extends string,
  const Urn extends string = string,
  const DefaultAccounts extends DefaultAccountSetting<`${Entity}/${string}`> | undefined =
    undefined,
>({
  urn,
  entities,
  dependsOn,
  defaultAccount,
}: {
  urn: Urn;
  entities: ReadonlyArray<Entity>;
  dependsOn?: ReadonlyArray<string>;
  defaultAccount?: DefaultAccounts & {
    [Key in Exclude<keyof DefaultAccounts, "*" | `${Entity}/${string}`>]: never;
  };
}): ConfigurableCapability<Entity, Urn, DefaultAccounts> {
  const capability = {
    urn,
    entities,
    ...(dependsOn === undefined ? {} : { dependsOn }),
    ...(defaultAccount === undefined ? {} : { defaultAccount }),
  };
  return {
    ...capability,
    withMethods: () => ({ ...capability }),
  };
}
