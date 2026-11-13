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

import { createClient, createClientWith, uniqueName } from "./client.ts";

describe("method calls", () => {
  it("sends method calls made in one tick as one request and settles each from its own response", async () => {
    const posts: string[] = [];
    const client = createClientWith(
      {
        hooks: {
          beforeFetch: [
            ({ request }) => {
              if (request.method === "POST") posts.push(request.url);
              return request;
            },
          ],
        },
      },
      "mail",
    );
    const { apiUrl } = await client.session;

    const [first, second, mailboxes] = await Promise.all([
      client.api.Core.echo({ marker: "first" }),
      client.api.Core.echo({ marker: "second" }),
      client.api.Mailbox.get({ properties: ["role"] }),
    ]);

    expect(posts).toEqual([apiUrl]);
    expect(first).toMatchObject({ marker: "first" });
    expect(second).toMatchObject({ marker: "second" });
    expect(mailboxes.list).toContainEqual(expect.objectContaining({ role: "inbox" }));
  });

  it("resolves a result reference on the server", async () => {
    const client = createClient("mail");
    const query = client.api.Mailbox.query({ filter: { role: "inbox" } });
    const mailboxes = client.api.Mailbox.get({ ids: query.resultRef("/ids") });

    const [{ ids }, { list }] = await Promise.all([query, mailboxes]);

    expect(ids).toHaveLength(1);
    expect(list).toEqual([expect.objectContaining({ id: ids[0], role: "inbox" })]);
  });

  it("resolves a creation ID on the server", async () => {
    const client = createClient("mail");
    const mailboxes = client.api.Mailbox.set({
      create: { box: { name: uniqueName("Created reference") } },
    });
    const emails = client.api.Email.set({
      create: {
        email: {
          mailboxIds: { [mailboxes.createdRef("box")]: true },
          subject: "Filed by creation ID",
        },
      },
    });

    const [mailboxResult, emailResult] = await Promise.all([mailboxes, emails]);
    expect(mailboxResult.notCreated).toBeFalsy();
    expect(emailResult.notCreated).toBeFalsy();
    const mailboxId = mailboxResult.created!.box!.id;
    const emailId = emailResult.created!.email!.id;

    const { list } = await client.api.Email.get({ ids: [emailId], properties: ["mailboxIds"] });
    expect(list).toEqual([{ id: emailId, mailboxIds: { [mailboxId]: true } }]);
  });
});
