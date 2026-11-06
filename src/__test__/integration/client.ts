// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { inject } from "vitest";

import type { DefaultCapabilities } from "../../built-ins.ts";
import { JsonMetaClient } from "../../index.ts";
import type { CapabilityOption, ClientApi } from "../../types.ts";

export function createClient<const T extends ReadonlyArray<CapabilityOption>>(
  ...capabilities: T
): JsonMetaClient<T, ClientApi<T> & ClientApi<DefaultCapabilities>> {
  const { sessionUrl, username, password } = inject("stalwart");
  return new JsonMetaClient({
    sessionUrl,
    capabilities,
    auth: { username, password },
  });
}
