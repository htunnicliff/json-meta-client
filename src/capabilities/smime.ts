// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { ExtendingCapability } from "../internal/types.ts";
import type { EmptyCapabilityDetails } from "../rfc-types/core/index.ts";
import type { EmailSmimeFilter, EmailSmimeProperties } from "../rfc-types/mail/index.ts";

// cspell:words smime smimeverify

/**
 * Adds the S/MIME verification URN to every `Email` and `SearchSnippet`
 * request, and types the `smime*` properties of `Email/get` and the
 * `hasSmime` and `hasVerifiedSmime` filter conditions. It adds no methods
 * and extends `mail`, which the client requires alongside it.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9219.html
 */
export const smime: ExtendingCapability<{
  entity: "Email" | "SearchSnippet";
  urn: "urn:ietf:params:jmap:smimeverify";
  extendedUrn: "urn:ietf:params:jmap:mail";
  accountCapabilities: EmptyCapabilityDetails;
  sessionCapabilities: EmptyCapabilityDetails;
  contractExtensions: {
    Email: {
      properties: EmailSmimeProperties;
      filter: EmailSmimeFilter;
    };
  };
}> = {
  urn: "urn:ietf:params:jmap:smimeverify",
  entities: ["Email", "SearchSnippet"],
  extends: "urn:ietf:params:jmap:mail",
};
