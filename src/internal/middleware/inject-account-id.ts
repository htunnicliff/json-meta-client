// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { mail } from "../../capabilities/mail.ts";
import type { Session } from "../../rfc-types/core/index.ts";
import type { MethodMiddleware } from "../types.ts";

// `accountId` names the destination account, which the client can't infer
const METHODS_REQUIRING_ACCOUNT_ID = new Set(["Blob/copy"]);

export function injectAccountId(getSession: () => Session): MethodMiddleware {
  return (args, method) => {
    // Add `accountId` if not set
    if (
      !METHODS_REQUIRING_ACCOUNT_ID.has(method) &&
      typeof args === "object" &&
      args !== null &&
      !Array.isArray(args) &&
      !Object.hasOwn(args, "accountId")
    ) {
      Object.defineProperty(args, "accountId", {
        get: () => getSession().primaryAccounts[mail.urn],
        enumerable: true,
      });
    }

    return args;
  };
}
