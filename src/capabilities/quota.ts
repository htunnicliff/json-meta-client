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
  QuotaChanges,
  QuotaGet,
  QuotaQuery,
  QuotaQueryChanges,
} from "../rfc-types/core/index.ts";

export const quota: Capability<
  "Quota",
  {
    Quota: {
      get: QuotaGet.Contract;
      changes: QuotaChanges.Contract;
      query: QuotaQuery.Contract;
      queryChanges: QuotaQueryChanges.Contract;
    };
  },
  "urn:ietf:params:jmap:quota"
> = {
  urn: "urn:ietf:params:jmap:quota",
  entities: ["Quota"],
};
