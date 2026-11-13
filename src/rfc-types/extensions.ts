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
  ContactsAccountCapabilities,
  ContactsSessionCapabilities,
} from "./contacts/rfc9610-contacts.ts";
import type { CoreAccountCapabilities, CoreSessionCapabilities } from "./core/rfc8620-jmap.ts";
import type { WebSocketSessionCapabilities } from "./core/rfc8887-websocket.ts";
import type { BlobAccountCapabilities, BlobSessionCapabilities } from "./core/rfc9404-blobs.ts";
import type { QuotaAccountCapabilities, QuotaSessionCapabilities } from "./core/rfc9425-quotas.ts";
import type {
  PrincipalsAccountCapabilities,
  PrincipalsOwnerAccountCapabilities,
  PrincipalsSessionCapabilities,
} from "./core/rfc9670-sharing.ts";
import type { WebPushVapidSessionCapabilities } from "./core/rfc9749-vapid.ts";
import type {
  MailAccountCapabilities,
  MailSessionCapabilities,
  SubmissionAccountCapabilities,
  SubmissionSessionCapabilities,
  VacationResponseAccountCapabilities,
  VacationResponseSessionCapabilities,
} from "./mail/rfc8621-mail.ts";
import type { MdnAccountCapabilities, MdnSessionCapabilities } from "./mail/rfc9007-mdn.ts";
import type {
  SmimeVerifyAccountCapabilities,
  SmimeVerifySessionCapabilities,
} from "./mail/rfc9219-mime.ts";
import type { SieveAccountCapabilities, SieveSessionCapabilities } from "./mail/rfc9661-sieve.ts";

// cspell:words smimeverify vacationresponse

/** Server-wide capability details for every capability URN this library knows. */
export interface SessionCapabilities {
  "urn:ietf:params:jmap:core": CoreSessionCapabilities;
  "urn:ietf:params:jmap:websocket": WebSocketSessionCapabilities;
  "urn:ietf:params:jmap:blob": BlobSessionCapabilities;
  "urn:ietf:params:jmap:quota": QuotaSessionCapabilities;
  "urn:ietf:params:jmap:principals": PrincipalsSessionCapabilities;
  "urn:ietf:params:jmap:webpush-vapid": WebPushVapidSessionCapabilities;
  "urn:ietf:params:jmap:contacts": ContactsSessionCapabilities;
  "urn:ietf:params:jmap:mail": MailSessionCapabilities;
  "urn:ietf:params:jmap:submission": SubmissionSessionCapabilities;
  "urn:ietf:params:jmap:vacationresponse": VacationResponseSessionCapabilities;
  "urn:ietf:params:jmap:mdn": MdnSessionCapabilities;
  "urn:ietf:params:jmap:smimeverify": SmimeVerifySessionCapabilities;
  "urn:ietf:params:jmap:sieve": SieveSessionCapabilities;
}

/** Per-account capability details for every capability URN this library knows. */
export interface AccountCapabilities {
  "urn:ietf:params:jmap:core": CoreAccountCapabilities;
  "urn:ietf:params:jmap:blob": BlobAccountCapabilities;
  "urn:ietf:params:jmap:quota": QuotaAccountCapabilities;
  "urn:ietf:params:jmap:principals": PrincipalsAccountCapabilities;
  "urn:ietf:params:jmap:principals:owner": PrincipalsOwnerAccountCapabilities;
  "urn:ietf:params:jmap:contacts": ContactsAccountCapabilities;
  "urn:ietf:params:jmap:mail": MailAccountCapabilities;
  "urn:ietf:params:jmap:submission": SubmissionAccountCapabilities;
  "urn:ietf:params:jmap:vacationresponse": VacationResponseAccountCapabilities;
  "urn:ietf:params:jmap:mdn": MdnAccountCapabilities;
  "urn:ietf:params:jmap:smimeverify": SmimeVerifyAccountCapabilities;
  "urn:ietf:params:jmap:sieve": SieveAccountCapabilities;
}
