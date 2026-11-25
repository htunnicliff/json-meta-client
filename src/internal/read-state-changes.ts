// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { StateChange } from "../rfc-types/core/rfc8620-jmap.ts";
import type { StateChangePayload } from "../types.ts";

/**
 * Whether a parsed push message is a `StateChange`
 */
export function isStateChange(message: unknown): message is StateChange {
  return (
    typeof message === "object" &&
    message !== null &&
    "@type" in message &&
    message["@type"] === "StateChange"
  );
}

/**
 * Read each entity's change from a `StateChange` message
 */
export function* readStateChanges(
  change: StateChange,
): Generator<Omit<StateChangePayload, "isPrimaryAccount">> {
  for (const [accountId, changes] of Object.entries(change.changed)) {
    for (const [entity, state] of Object.entries(changes)) {
      yield { entity, state, accountId };
    }
  }
}
