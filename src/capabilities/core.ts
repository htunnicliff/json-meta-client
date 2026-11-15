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
import type {
  BlobCopy,
  CoreEcho,
  CoreSessionCapabilities,
  PushSubscriptionGet,
  PushSubscriptionSet,
} from "../rfc-types/core/index.ts";

export const core: Capability<
  "Core" | "Blob" | "PushSubscription",
  {
    Core: {
      echo: CoreEcho.Contract;
    };
    Blob: {
      copy: BlobCopy.Contract;
    };
    PushSubscription: {
      get: PushSubscriptionGet.Contract;
      set: PushSubscriptionSet.Contract;
    };
  },
  "urn:ietf:params:jmap:core",
  unknown,
  CoreSessionCapabilities,
  { "Blob/copy": null }
> = {
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core", "Blob", "PushSubscription"],
  // `Blob/copy` copies blobs into `accountId`, and nothing in the call says
  // which account that should be. `Core/echo` and `PushSubscription` calls
  // aren't scoped to an account, so core claims nothing else.
  defaultAccount: { "Blob/copy": null },
};
