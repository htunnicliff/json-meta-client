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
import type { VacationResponseGet, VacationResponseSet } from "../rfc-types/mail/index.ts";

// cspell:words vacationresponse

export const vacationResponse: Capability<
  "VacationResponse",
  {
    VacationResponse: {
      get: VacationResponseGet.Contract;
      set: VacationResponseSet.Contract;
    };
  },
  "urn:ietf:params:jmap:vacationresponse"
> = {
  urn: "urn:ietf:params:jmap:vacationresponse",
  entities: ["VacationResponse"],
};
