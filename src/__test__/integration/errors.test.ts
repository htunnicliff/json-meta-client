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

import { HttpError, JmapError } from "../../index.ts";
import { createClient, createClientWith } from "./client.ts";

describe("errors", () => {
  it("rejects a method call with a JmapError while the rest of the batch resolves", async () => {
    const client = createClient("mail");
    const missing = client.api.Mailbox.get({ accountId: "missing-account" });
    const mailboxes = client.api.Mailbox.get({});

    const [missingResult, mailboxesResult] = await Promise.allSettled([missing, mailboxes]);

    expect(missingResult.status).toBe("rejected");
    const error: unknown = missingResult.status === "rejected" && missingResult.reason;
    expect(error).toBeInstanceOf(JmapError);
    expect(error).toMatchObject({
      // RFC 8620 §3.6.2; Stalwart v0.11 answered with `forbidden` instead
      type: "accountNotFound",
      methodCall: {
        method: "Mailbox/get",
        args: expect.objectContaining({ accountId: "missing-account" }),
      },
    });
    expect(mailboxesResult).toMatchObject({
      status: "fulfilled",
      value: { list: expect.arrayContaining([expect.objectContaining({ role: "inbox" })]) },
    });
  });

  it("rejects every method call with the same HttpError when the batch exceeds maxCallsInRequest", async () => {
    const client = createClient("mail");
    const session = await client.session;
    const { maxCallsInRequest } = session.capabilities["urn:ietf:params:jmap:core"];

    const results = await Promise.allSettled(
      Array.from({ length: maxCallsInRequest + 1 }, (_, index) => client.api.Core.echo({ index })),
    );

    const reasons = new Set(
      results.map((result) => (result.status === "rejected" ? result.reason : result)),
    );
    expect(reasons.size).toBe(1);
    const [error] = reasons;
    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({
      status: 400,
      responseData: {
        type: "urn:ietf:params:jmap:error:limit",
        limit: "maxCallsInRequest",
      },
    });
  });

  it("rejects the session with an HttpError when the server rejects the credentials", async () => {
    const { username } = inject("stalwart");
    const client = createClientWith({ auth: { username, password: "wrong-password" } }, "mail");

    const error: unknown = await client.session.catch((reason: unknown) => reason);

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status: 401, responseData: { status: 401 } });
  });
});
