// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { Capability } from "../capability.ts";

export function mapEntitiesToUrns(capabilities: Iterable<Capability>): Record<string, string[]> {
  const entityToUrns: Record<string, string[]> = Object.create(null);

  for (const { urn, entities, dependsOn = [] } of capabilities) {
    for (const entity of entities) {
      const urns = (entityToUrns[entity] ??= []);
      for (const used of [urn, ...dependsOn]) {
        if (!urns.includes(used)) {
          urns.push(used);
        }
      }
    }
  }

  return entityToUrns;
}
