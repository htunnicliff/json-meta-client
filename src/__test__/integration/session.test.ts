// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { describe, expect, inject, it } from "vitest";

import { createClient, createClientWith } from "./client.ts";

describe("session", () => {
  it("discovers a session and retrieves mailboxes through the client", async () => {
    const client = createClient("mail");
    const session = await client.session;

    expect(session.capabilities["urn:ietf:params:jmap:core"]?.maxCallsInRequest).toBeGreaterThan(0);

    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"];
    expect(accountId).toBeTruthy();

    const mailboxes = await client.api.Mailbox.get({ accountId });
    expect(mailboxes.accountId).toBe(accountId);
    expect(mailboxes.list).toContainEqual(
      expect.objectContaining({
        role: "inbox",
      }),
    );
  });

  it("refreshes the session with a second fetch for the same account", async () => {
    const { sessionUrl } = inject("stalwart");
    const sessionFetches: string[] = [];
    const client = createClientWith(
      {
        hooks: {
          beforeFetch: [
            ({ request }) => {
              if (request.url === sessionUrl) sessionFetches.push(request.url);
              return request;
            },
          ],
        },
      },
      "mail",
    );
    const first = await client.session;

    const refreshed = await client.refreshSession();

    expect(sessionFetches).toHaveLength(2);
    expect(refreshed).not.toBe(first);
    expect(refreshed.username).toBe(first.username);
    expect(refreshed.primaryAccounts).toEqual(first.primaryAccounts);
    expect(Object.keys(refreshed.accounts)).toEqual(Object.keys(first.accounts));
    await expect(client.session).resolves.toBe(refreshed);
  });
});
