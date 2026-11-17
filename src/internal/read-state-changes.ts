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
 * Read each entity's change from an event-stream message. Messages other
 * than a `StateChange` have none.
 */
export function* readStateChanges(
  data: string,
): Generator<Omit<StateChangePayload, "isPrimaryAccount">> {
  const payload = JSON.parse(data);
  if (payload["@type"] !== "StateChange") {
    return;
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  const { changed } = payload as StateChange;
  for (const [accountId, changes] of Object.entries(changed)) {
    for (const [entity, state] of Object.entries(changes)) {
      yield { entity, state, accountId };
    }
  }
}
