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
import type { MDNParse, MDNSend } from "../rfc-types/mail/index.ts";

export const mdn: Capability<
  "MDN",
  {
    MDN: {
      send: MDNSend.Contract;
      parse: MDNParse.Contract;
    };
  },
  "urn:ietf:params:jmap:mdn"
> = {
  urn: "urn:ietf:params:jmap:mdn",
  entities: ["MDN"],
};
