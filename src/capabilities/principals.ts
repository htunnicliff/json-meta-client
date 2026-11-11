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
  PrincipalChanges,
  PrincipalGet,
  PrincipalQuery,
  PrincipalQueryChanges,
  PrincipalSet,
  ShareNotificationChanges,
  ShareNotificationGet,
  ShareNotificationQuery,
  ShareNotificationQueryChanges,
  ShareNotificationSet,
} from "../rfc-types/core/index.ts";
import type { AccountCapabilities } from "../rfc-types/extensions.ts";

/**
 * Account details advertised by the JMAP Principals capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9670.html#section-2
 */
export type PrincipalsAccountCapabilities = AccountCapabilities["urn:ietf:params:jmap:principals"];

export const principals: Capability<
  "Principal" | "ShareNotification",
  {
    Principal: {
      get: PrincipalGet.Contract;
      changes: PrincipalChanges.Contract;
      set: PrincipalSet.Contract;
      query: PrincipalQuery.Contract;
      queryChanges: PrincipalQueryChanges.Contract;
    };
    ShareNotification: {
      get: ShareNotificationGet.Contract;
      changes: ShareNotificationChanges.Contract;
      set: ShareNotificationSet.Contract;
      query: ShareNotificationQuery.Contract;
      queryChanges: ShareNotificationQueryChanges.Contract;
    };
  },
  "urn:ietf:params:jmap:principals",
  PrincipalsAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:principals",
  entities: ["Principal", "ShareNotification"],
};
