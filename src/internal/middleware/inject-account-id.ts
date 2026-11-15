// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { Session } from "../../rfc-types/core/index.ts";
import type { FindMethodOwner } from "../method-owners.ts";
import type { Middleware } from "../types.ts";

/**
 * Adds `accountId` to a method call that doesn't pass one, when the
 * capability that owns the call defaults to its primary account. The account
 * is read when the request is serialized, after the session has loaded; if
 * the session lists no primary account for the owner's URN, the call is sent
 * without `accountId`.
 */
export function injectAccountId(
  getSession: () => Session,
  findMethodOwner: FindMethodOwner,
): Middleware {
  return (args, { name }) => {
    const owner = findMethodOwner(name);
    if (
      owner?.defaultAccount === "primary" &&
      typeof args === "object" &&
      args !== null &&
      !Array.isArray(args) &&
      !Object.hasOwn(args, "accountId")
    ) {
      const { urn } = owner;
      Object.defineProperty(args, "accountId", {
        get: () => getSession().primaryAccounts[urn],
        enumerable: true,
      });
    }

    return args;
  };
}
