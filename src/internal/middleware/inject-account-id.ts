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
import { METHODS_WITHOUT_DEFAULT_ACCOUNT_ID } from "../default-account-id.ts";
import type { Middleware } from "../types.ts";

export function injectAccountId(getSession: () => Session): Middleware {
  const withoutDefault: ReadonlySet<string> = new Set(METHODS_WITHOUT_DEFAULT_ACCOUNT_ID);
  return (args, { name }) => {
    // Add `accountId` if not set
    if (
      !withoutDefault.has(name) &&
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
