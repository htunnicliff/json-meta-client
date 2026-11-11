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
 * A fully configured capability:
 * - Known entities (type and value)
 * - Known urn (value)
 * - Other URNs its methods need in a request's `using` array (value)
 * - Known methods (type)
 * - Known account capability details (type)
 * - Known session capability details (type)
 */
export interface Capability<
  Entity extends string = string,
  _Methods extends CapabilityMethods<Entity> = CapabilityMethods<Entity>,
  Urn extends string = string,
  _AccountCapabilities = unknown,
  _SessionCapabilities = unknown,
> {
  urn: Urn;
  entities: ReadonlyArray<Entity>;
  /**
   * Other capability URNs that the server needs in a request's `using`
   * array when calling this capability's methods. The client adds them
   * alongside {@link Capability.urn}.
   */
  dependsOn?: ReadonlyArray<string>;
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
export function defineCapability<const Entity extends string, const Urn extends string = string>({
  urn,
  entities,
  dependsOn,
}: {
  urn: Urn;
  entities: ReadonlyArray<Entity>;
  dependsOn?: ReadonlyArray<string>;
}): ConfigurableCapability<Entity, Urn> {
  const capability = dependsOn === undefined ? { urn, entities } : { urn, entities, dependsOn };
  return {
    ...capability,
    withMethods: () => ({ ...capability }),
  };
}
