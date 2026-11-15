// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { describe, expect, it } from "vitest";

import { makeSession } from "../../__test__/fixtures.ts";
import type { Session } from "../../rfc-types/core/index.ts";
import { resolveDefaultAccount } from "../default-account.ts";
import type { MethodOwner } from "../method-owners.ts";

const urn = "urn:example:tasks";
const owner: MethodOwner = { urn, defaultAccount: "primary" };

/** A session with the given primary accounts and each account's capability URNs */
function sessionWith(
  primaryAccounts: Record<string, string>,
  urnsByAccountId: Record<string, string[]>,
): Session {
  return {
    ...makeSession(),
    primaryAccounts,
    accounts: Object.fromEntries(
      Object.entries(urnsByAccountId).map(([id, urns]) => [
        id,
        {
          name: id,
          isPersonal: true,
          isReadOnly: false,
          accountCapabilities: Object.fromEntries(urns.map((urn) => [urn, {}])),
        },
      ]),
    ),
  };
}

describe(resolveDefaultAccount, () => {
  const session = sessionWith({ [urn]: "primary" }, { primary: [urn], other: [urn] });

  it("gives a method call that no capability owns no default account", () => {
    expect(resolveDefaultAccount(undefined, session)).toEqual({ status: "none" });
  });

  it("gives a method call whose owner sets it to null no default account", () => {
    expect(resolveDefaultAccount({ urn, defaultAccount: null }, session)).toEqual({
      status: "none",
    });
  });

  it("resolves to the session's primary account for the owner's URN", () => {
    expect(resolveDefaultAccount(owner, session)).toEqual({
      status: "resolved",
      accountId: "primary",
    });
  });

  it("ignores the primary accounts of other URNs", () => {
    const session = sessionWith({ "urn:other": "other" }, { other: ["urn:other"], tasks: [urn] });

    expect(resolveDefaultAccount(owner, session)).toEqual({
      status: "resolved",
      accountId: "tasks",
    });
  });

  it("falls back to the only account whose capabilities include the owner's URN", () => {
    const session = sessionWith({}, { mail: ["urn:mail"], tasks: ["urn:mail", urn] });

    expect(resolveDefaultAccount(owner, session)).toEqual({
      status: "resolved",
      accountId: "tasks",
    });
  });

  it("is unavailable when no account's capabilities include the owner's URN", () => {
    const session = sessionWith({}, { mail: ["urn:mail"] });

    expect(resolveDefaultAccount(owner, session)).toEqual({ status: "unavailable" });
  });

  it("is unavailable when the session lists no accounts", () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const session = { primaryAccounts: {} } as Session;

    expect(resolveDefaultAccount(owner, session)).toEqual({ status: "unavailable" });
  });

  it("is ambiguous when several accounts' capabilities include the owner's URN", () => {
    const session = sessionWith({}, { one: [urn], two: [urn], mail: ["urn:mail"] });

    expect(resolveDefaultAccount(owner, session)).toEqual({ status: "ambiguous", urn });
  });
});
