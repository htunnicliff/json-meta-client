// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { describe, expect, it, vi } from "vitest";

import { mail } from "../capabilities/mail.ts";
import { JsonMetaClient } from "../client.ts";
import { ResultReferenceError } from "../errors/index.ts";
import type { Request as JMAPRequest } from "../rfc-types/core/index.ts";

const apiUrl = "https://example.test/api";
const accountId = "account";

function isJmapRequest(value: unknown): value is JMAPRequest {
  return (
    typeof value === "object" &&
    value !== null &&
    "using" in value &&
    Array.isArray(value.using) &&
    "methodCalls" in value &&
    Array.isArray(value.methodCalls)
  );
}

/**
 * A client whose server records each JMAP Request and answers every method
 * call with its method name under its own method call ID
 */
function setup() {
  const requests: JMAPRequest[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn<typeof fetch>(async (input) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/session")) {
        return Response.json({
          apiUrl,
          accounts: {
            [accountId]: {
              name: "Account",
              isPersonal: true,
              isReadOnly: false,
              accountCapabilities: { [mail.urn]: {} },
            },
          },
          primaryAccounts: { [mail.urn]: accountId },
          capabilities: { [mail.urn]: {} },
        });
      }
      if (url === apiUrl) {
        if (!(input instanceof Request)) throw new TypeError("Expected a Request");
        const body: unknown = JSON.parse(await input.text());
        if (!isJmapRequest(body)) throw new TypeError("Expected a JMAP request");
        requests.push(body);
        return Response.json({
          methodResponses: body.methodCalls.map(([method, , id]) => [method, { method }, id]),
          sessionState: "state",
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }),
  );
  const client = new JsonMetaClient({
    sessionUrl: "https://example.test/session",
    auth: "test",
    capabilities: [mail],
  });
  return { client, requests };
}

/** The method call IDs of each request's method calls, one list per request */
function callIds(requests: JMAPRequest[]): string[][] {
  return requests.map(({ methodCalls }) => methodCalls.map(([, , id]) => id));
}

describe("result references (RFC 8620 section 3.7)", () => {
  it("rejects only the method call with a reference nested below the top level", async () => {
    const { client, requests } = setup();
    const mailboxes = client.api.Mailbox.query({ filter: { role: "inbox" } });
    const emails = client.api.Email.query({
      // @ts-expect-error A reference can't be nested inside an argument.
      filter: { inMailbox: mailboxes.resultRef("/ids/0") },
    });

    const error = await emails.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ResultReferenceError);
    expect(error).toMatchObject({
      reason: "nested",
      path: "/filter/inMailbox",
      methodCall: { id: emails.$id, method: "Email/query" },
    });
    await expect(mailboxes).resolves.toEqual({ method: "Mailbox/query" });
    expect(callIds(requests)).toEqual([[mailboxes.$id]]);
  });

  it("rejects a reference inside an array argument", async () => {
    const { client, requests } = setup();
    const mailboxes = client.api.Mailbox.query({ filter: { role: "inbox" } });
    const get = client.api.Mailbox.get({
      // @ts-expect-error A reference can't be an item of an array argument.
      ids: ["inbox", mailboxes.resultRef("/ids/0")],
    });

    await expect(get).rejects.toMatchObject({ reason: "nested", path: "/ids/1" });
    await mailboxes;
    expect(callIds(requests)).toEqual([[mailboxes.$id]]);
  });

  it("rejects arguments that name both foo and #foo", async () => {
    const { client, requests } = setup();
    const query = client.api.Email.query({});
    const reference = { name: "Email/query", resultOf: query.$id, path: "/ids" };
    // The types reject `#ids`, but plain JavaScript can pass it
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const withRef = client.api.Email.get({
      ids: query.resultRef("/ids"),
      "#ids": reference,
    } as never);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const withValue = client.api.Email.get({ ids: ["email"], "#ids": reference } as never);

    await expect(withRef).rejects.toMatchObject({ reason: "duplicate-argument", path: "/ids" });
    await expect(withValue).rejects.toBeInstanceOf(ResultReferenceError);
    await expect(withValue).rejects.toMatchObject({ reason: "duplicate-argument", path: "/ids" });
    expect(callIds(requests)).toEqual([[query.$id]]);
  });

  it("rejects a reference to a method call from an earlier batch and sends the rest", async () => {
    const { client, requests } = setup();
    const query = client.api.Email.query({});
    await query;
    const get = client.api.Email.get({ ids: query.resultRef("/ids") });
    const mailboxes = client.api.Mailbox.get({ ids: null });

    const error = await get.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ResultReferenceError);
    expect(error).toMatchObject({
      reason: "cross-batch",
      resultOf: query.$id,
      methodCall: { id: get.$id },
    });
    await expect(mailboxes).resolves.toEqual({ method: "Mailbox/get" });
    expect(callIds(requests)).toEqual([[query.$id], [mailboxes.$id]]);
  });

  it("rejects a method call whose ID is already in its batch and settles the first", async () => {
    const { client, requests } = setup();
    const first = client.api.Email.query({}, { id: "same" });
    const second = client.api.Mailbox.query({}, { id: "same" });

    await expect(first).resolves.toEqual({ method: "Email/query" });
    const error = await second.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ResultReferenceError);
    expect(error).toMatchObject({
      reason: "duplicate-id",
      methodCall: { method: "Mailbox/query" },
    });
    expect(requests[0]!.methodCalls).toEqual([["Email/query", { accountId }, "same"]]);
  });
});
