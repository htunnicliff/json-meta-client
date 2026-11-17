// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { ContactsAccountCapabilities } from "./contacts/rfc9610-contacts.ts";
import type { CoreSessionCapabilities, EmptyCapabilityDetails } from "./core/rfc8620-jmap.ts";
import type { WebSocketSessionCapabilities } from "./core/rfc8887-websocket.ts";
import type { BlobAccountCapabilities } from "./core/rfc9404-blobs.ts";
import type {
  PrincipalsAccountCapabilities,
  PrincipalsOwnerAccountCapabilities,
} from "./core/rfc9670-sharing.ts";
import type { WebPushVapidSessionCapabilities } from "./core/rfc9749-vapid.ts";
import type {
  MailAccountCapabilities,
  SubmissionAccountCapabilities,
} from "./mail/rfc8621-mail.ts";
import type { SieveAccountCapabilities, SieveSessionCapabilities } from "./mail/rfc9661-sieve.ts";

// cspell:words smimeverify vacationresponse

/** Server-wide capability details for every capability URN this library knows. */
export interface SessionCapabilities {
  "urn:ietf:params:jmap:core": CoreSessionCapabilities;
  "urn:ietf:params:jmap:websocket": WebSocketSessionCapabilities;
  "urn:ietf:params:jmap:blob": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:quota": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:principals": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:webpush-vapid": WebPushVapidSessionCapabilities;
  "urn:ietf:params:jmap:contacts": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:mail": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:submission": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:vacationresponse": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:mdn": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:smimeverify": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:sieve": SieveSessionCapabilities;
}

/** Per-account capability details for every capability URN this library knows. */
export interface AccountCapabilities {
  "urn:ietf:params:jmap:core": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:blob": BlobAccountCapabilities;
  "urn:ietf:params:jmap:quota": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:principals": PrincipalsAccountCapabilities;
  "urn:ietf:params:jmap:principals:owner": PrincipalsOwnerAccountCapabilities;
  "urn:ietf:params:jmap:contacts": ContactsAccountCapabilities;
  "urn:ietf:params:jmap:mail": MailAccountCapabilities;
  "urn:ietf:params:jmap:submission": SubmissionAccountCapabilities;
  "urn:ietf:params:jmap:vacationresponse": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:mdn": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:smimeverify": EmptyCapabilityDetails;
  "urn:ietf:params:jmap:sieve": SieveAccountCapabilities;
}
