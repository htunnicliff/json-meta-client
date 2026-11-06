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
  PushSubscriptionGet,
  PushSubscriptionSet,
} from "../rfc-types/core/index.ts";
import type { SessionCapabilities } from "../rfc-types/extensions.ts";

/**
 * Server-wide limits and features advertised by the JMAP Core capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8620.html#section-2
 */
export type CoreSessionCapabilities = SessionCapabilities["urn:ietf:params:jmap:core"];

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
  CoreSessionCapabilities
> = {
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core", "Blob", "PushSubscription"],
};
