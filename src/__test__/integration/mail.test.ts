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

import { createClient, uniqueName } from "./client.ts";

describe("mail", () => {
  it("creates mail, then queries it with a filter and sort and gets selected properties", async () => {
    const client = createClient("mail");
    const mailboxes = client.api.Mailbox.set({
      create: { box: { name: uniqueName("Mail round trip") } },
    });
    const mailboxIds = { [mailboxes.createdRef("box")]: true as const };
    const emails = client.api.Email.set({
      create: {
        bravo: { mailboxIds, subject: "Bravo", keywords: { $flagged: true } },
        alpha: { mailboxIds, subject: "Alpha", keywords: { $flagged: true } },
        charlie: { mailboxIds, subject: "Charlie", keywords: {} },
      },
    });
    const [mailboxResult, emailResult] = await Promise.all([mailboxes, emails]);
    expect(mailboxResult.notCreated).toBeFalsy();
    expect(emailResult.notCreated).toBeFalsy();
    const mailboxId = mailboxResult.created!.box!.id;

    const query = client.api.Email.query({
      filter: {
        operator: "AND",
        conditions: [{ inMailbox: mailboxId }, { hasKeyword: "$flagged" }],
      },
      sort: [{ property: "subject", isAscending: true }],
    });
    const flagged = client.api.Email.get({
      ids: query.resultRef("/ids"),
      properties: ["subject", "mailboxIds"],
    });

    const [{ ids }, { list }] = await Promise.all([query, flagged]);

    expect(ids).toEqual([emailResult.created!.alpha!.id, emailResult.created!.bravo!.id]);
    expect(list).toEqual([
      { id: ids[0], subject: "Alpha", mailboxIds: { [mailboxId]: true } },
      { id: ids[1], subject: "Bravo", mailboxIds: { [mailboxId]: true } },
    ]);
  });
});
