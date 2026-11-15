// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { Capability, DefaultAccount } from "../capability.ts";
import { CapabilityConfigurationError } from "../errors.ts";

/** The capability that claims a method call, and the default account it gives it. */
export interface MethodOwner {
  urn: string;
  defaultAccount: DefaultAccount;
}

/** Finds the owner of a method call by its `Entity/method` name. */
export type FindMethodOwner = (name: string) => MethodOwner | undefined;

/**
 * Maps each method call to the capability that claims it in its
 * `defaultAccount` setting. A listed method name beats another capability's
 * `"*"`. Extending capabilities never claim method calls.
 *
 * @throws {CapabilityConfigurationError} when two capabilities claim the same
 * method call with different URNs or default accounts
 */
export function mapMethodOwners(capabilities: Iterable<Capability>): FindMethodOwner {
  const listed = new Map<string, MethodOwner>();
  const wildcards = new Map<string, MethodOwner>();

  const claim = (
    claims: Map<string, MethodOwner>,
    key: string,
    owner: MethodOwner,
    capability: Capability,
  ) => {
    const existing = claims.get(key);
    if (existing === undefined) {
      claims.set(key, owner);
    } else if (existing.urn !== owner.urn || existing.defaultAccount !== owner.defaultAccount) {
      const message =
        claims === listed
          ? `Capabilities ${existing.urn} and ${owner.urn} both claim ${key} in \`defaultAccount\``
          : `Capabilities ${existing.urn} and ${owner.urn} both claim every ${key} method; ` +
            "list the methods one of them claims in its `defaultAccount`";
      throw new CapabilityConfigurationError(message, { capability });
    }
  };

  for (const capability of capabilities) {
    if ("extends" in capability) continue;

    const { urn, entities, defaultAccount: setting = { "*": "primary" } } = capability;
    for (const [key, defaultAccount] of Object.entries(setting)) {
      // An explicit `undefined` reads as an omitted key
      if (defaultAccount === undefined) continue;

      const owner = { urn, defaultAccount };
      if (key === "*") {
        for (const entity of new Set(entities)) {
          claim(wildcards, entity, owner, capability);
        }
      } else {
        claim(listed, key, owner, capability);
      }
    }
  }

  return (name) => {
    if (listed.has(name)) return listed.get(name);
    const entity = name.slice(0, name.indexOf("/"));
    return wildcards.get(entity);
  };
}
