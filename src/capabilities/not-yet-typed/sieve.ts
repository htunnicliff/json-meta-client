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
  GetArguments,
  GetResponse,
  QueryArguments,
  QueryResponse,
  SetArguments,
  SetError,
  SetResponse,
} from "jmap-rfc-types";

import type { Capability } from "../../capability.ts";

// cspell:words enotify extlists

/**
 * Server implementation advertised by the JMAP Sieve capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9661.html#section-1.2.1
 */
export interface SieveSessionCapabilities {
  implementation: string;
}

/**
 * Account limits and extensions advertised by the JMAP Sieve capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9661.html#section-1.2.1
 */
export interface SieveAccountCapabilities {
  maxSizeScriptName: number;
  /** Maximum script size in octets, or null for no limit. */
  maxSizeScript: number | null;
  maxNumberScripts: number | null;
  maxNumberRedirects: number | null;
  sieveExtensions: string[];
  /** Supported notification URI schemes, or null if enotify is unsupported. */
  notificationMethods: string[] | null;
  /** Supported external list URI schemes, or null if extlists is unsupported. */
  externalLists: string[] | null;
}

export const sieve: Capability<
  "SieveScript",
  {
    SieveScript: {
      get: {
        input: GetArguments<any>;
        output: GetResponse<any, any>;
      };
      query: {
        input: QueryArguments<any>;
        output: QueryResponse;
      };
      set: {
        input: SetArguments<any>;
        output: SetResponse<any, any>;
      };
      validate: {
        input: {
          accountId: string;
          blobId: string;
        };
        output: {
          accountId: string;
          error: SetError<any> | null;
        };
      };
    };
  },
  "urn:ietf:params:jmap:sieve",
  SieveAccountCapabilities,
  SieveSessionCapabilities
> = {
  urn: "urn:ietf:params:jmap:sieve",
  entities: ["SieveScript"],
};
