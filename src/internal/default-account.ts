// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { Session } from "../rfc-types/core/index.ts";
import type { MethodOwner } from "./method-owners.ts";

/**
 * The default account of a method call that doesn't pass `accountId`:
 *
 * - `resolved`: the account whose ID the client adds
 * - `none`: no capability gives the method call a default account
 * - `unavailable`: no account in the session can use the owner's methods
 * - `ambiguous`: several accounts can, and the session names no primary
 */
export type DefaultAccountResolution =
  | { status: "resolved"; accountId: string }
  | { status: "none" }
  | { status: "unavailable" }
  | { status: "ambiguous"; urn: string };

/**
 * Chooses the default account that a method call's owner gives it: the
 * session's primary account for the owner's URN, or else the only account
 * whose capabilities include that URN.
 */
export function resolveDefaultAccount(
  owner: MethodOwner | undefined,
  session: Session,
): DefaultAccountResolution {
  if (owner?.defaultAccount !== "primary") return { status: "none" };

  const { urn } = owner;
  const primary = session.primaryAccounts[urn];
  if (primary !== undefined) return { status: "resolved", accountId: primary };

  // RFC 8620 §2: an account lists every capability whose methods it can use
  const [accountId, ...others] = Object.entries(session.accounts ?? {})
    .filter(([, account]) => Object.hasOwn(account.accountCapabilities ?? {}, urn))
    .map(([id]) => id);
  if (accountId === undefined) return { status: "unavailable" };
  if (others.length > 0) return { status: "ambiguous", urn };
  return { status: "resolved", accountId };
}
