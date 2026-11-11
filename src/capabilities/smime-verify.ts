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

/**
 * Adds the S/MIME verification URN to every `Email` request so the server
 * returns the `smime*` properties and accepts the `hasSmime` and
 * `hasVerifiedSmime` filters. It adds no methods: enable `mail` for those.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9219.html
 */
export const smimeVerify: Capability<
  "Email",
  {
    Email: {};
  },
  "urn:ietf:params:jmap:smimeverify"
> = {
  urn: "urn:ietf:params:jmap:smimeverify",
  entities: ["Email"],
};
