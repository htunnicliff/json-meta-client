// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { Request as JMAPRequest } from "jmap-rfc-types";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { mail } from "../capabilities/mail.ts";
import { submission } from "../capabilities/submission.ts";
import { JsonMetaClient } from "../client.ts";

const apiUrl = "https://example.test/api";

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

function setup() {
  const requests: JMAPRequest[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = input instanceof Request ? input.url : String(input);
    if (url.endsWith("/session")) {
      return Response.json({
        apiUrl,
        primaryAccounts: {
          [mail.urn]: "account",
          [submission.urn]: "account",
        },
        capabilities: { [mail.urn]: {}, [submission.urn]: {} },
      });
    }
    if (url === apiUrl) {
      if (!(input instanceof Request)) throw new TypeError("Expected a Request");
      const body: unknown = JSON.parse(await input.text());
      if (!isJmapRequest(body)) throw new TypeError("Expected a JMAP request");
      requests.push(body);
      return Response.json({
        methodResponses: body.methodCalls.map(([method, , id]) => [method, {}, id]),
        sessionState: "state",
      });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetchMock);
  const client = new JsonMetaClient({
    sessionUrl: "https://example.test/session",
    bearerToken: "test",
    capabilities: [mail, submission],
  });
  return { client, requests };
}

describe("set creation references", () => {
  it("works with unmodified built-in Email and EmailSubmission contracts", async () => {
    const { client, requests } = setup();
    const draft = client.api.Email.set({
      create: {
        draft: {
          keywords: { $draft: true },
          subject: "Hello",
          from: [{ email: "sender@example.test" }],
          to: [{ email: "recipient@example.test" }],
        },
      },
    });

    expectTypeOf(draft.createdRef("draft")).toEqualTypeOf<"#draft">();
    expect(draft.createdRef("draft")).toBe("#draft");

    const sent = client.api.EmailSubmission.set({
      create: {
        submission: {
          emailId: draft.createdRef("draft"),
          identityId: "identity",
        },
      },
    });
    await Promise.all([draft, sent]);
    expect(requests).toHaveLength(1);
    const payload = requests[0];
    if (!payload) throw new Error("Expected one JMAP request");
    expect(payload.methodCalls[1]?.[1]).toMatchObject({
      create: { submission: { emailId: "#draft", identityId: "identity" } },
    });
  });

  it("rejects an unknown creation ID from a real Email.set call", async () => {
    const { client } = setup();
    const draft = client.api.Email.set({ create: { draft: { subject: "Hello" } } });
    expect(() => Reflect.apply(draft.createdRef, draft, ["missing"])).toThrow(RangeError);
    await draft;
  });

  it("only augments set methods", async () => {
    const { client } = setup();
    const query = client.api.Email.query({});
    expect(query).not.toHaveProperty("createdRef");
    await query;
  });
});
