// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type {
  BlobContracts,
  CoreContracts,
  PushSubscriptionContracts,
} from "jmap-rfc-types/contracts";

import type { Capability } from "../capability.ts";

/**
 * Server-wide limits and features advertised by the JMAP Core capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8620.html#section-2
 */
export interface CoreSessionCapabilities {
  maxSizeUpload: number;
  maxConcurrentUpload: number;
  maxSizeRequest: number;
  maxConcurrentRequests: number;
  maxCallsInRequest: number;
  maxObjectsInGet: number;
  maxObjectsInSet: number;
  collationAlgorithms: string[];
}

export const core: Capability<
  "Core" | "Blob" | "PushSubscription",
  {
    Core: {
      get: CoreContracts.Get.Contract;
    };
    Blob: {
      copy: BlobContracts.Copy.Contract;
    };
    PushSubscription: {
      get: PushSubscriptionContracts.Get.Contract;
      set: PushSubscriptionContracts.Set.Contract;
    };
  },
  "urn:ietf:params:jmap:core",
  unknown,
  CoreSessionCapabilities
> = {
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core", "Blob", "PushSubscription"],
};
