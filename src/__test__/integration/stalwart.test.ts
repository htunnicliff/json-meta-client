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

import { createClient } from "./client.ts";

describe("Stalwart integration harness", () => {
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
});
