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
import type { AccountCapabilities, SessionCapabilities } from "../rfc-types/extensions.ts";
import type {
  SieveScriptGet,
  SieveScriptQuery,
  SieveScriptSet,
  SieveScriptValidate,
} from "../rfc-types/mail/index.ts";

// cspell:words enotify extlists

/**
 * Server implementation advertised by the JMAP Sieve capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9661.html#section-1.2.1
 */
export type SieveSessionCapabilities = SessionCapabilities["urn:ietf:params:jmap:sieve"];

/**
 * Account limits and extensions advertised by the JMAP Sieve capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9661.html#section-1.2.1
 */
export type SieveAccountCapabilities = AccountCapabilities["urn:ietf:params:jmap:sieve"];

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
