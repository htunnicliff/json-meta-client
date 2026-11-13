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
  SieveAccountCapabilities,
  SieveScriptGet,
  SieveScriptQuery,
  SieveScriptSet,
  SieveScriptValidate,
  SieveSessionCapabilities,
} from "../rfc-types/mail/index.ts";

// cspell:words enotify extlists

export const sieve: Capability<
  "SieveScript",
  {
    SieveScript: {
      get: SieveScriptGet.Contract;
      query: SieveScriptQuery.Contract;
      set: SieveScriptSet.Contract;
      validate: SieveScriptValidate.Contract;
    };
  },
  "urn:ietf:params:jmap:sieve",
  SieveAccountCapabilities,
  SieveSessionCapabilities
> = {
  urn: "urn:ietf:params:jmap:sieve",
  entities: ["SieveScript"],
};
