import { describe, expect, expectTypeOf, it, vi } from "vitest";

import { mail } from "../capabilities/mail.ts";
import { submission } from "../capabilities/submission.ts";
import { JsonMetaClient } from "../client.ts";

const apiUrl = "https://example.test/api";

function setup() {
  const requests: unknown[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
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
      const body = JSON.parse(String(init?.body)) as {
        methodCalls: Array<[string, unknown, string]>;
      };
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

    expectTypeOf(draft.created("draft")).toEqualTypeOf<"#draft">();
    expect(draft.created("draft")).toBe("#draft");

    const sent = client.api.EmailSubmission.set({
      create: {
        submission: {
          emailId: draft.created("draft"),
          identityId: "identity",
        },
      },
    });
    await Promise.all([draft, sent]);
    expect(requests).toHaveLength(1);
    const payload = requests[0] as {
      methodCalls: Array<[string, { create: Record<string, unknown> }, string]>;
    };
    expect(payload.methodCalls[1]?.[1]).toMatchObject({
      create: { submission: { emailId: "#draft", identityId: "identity" } },
    });
  });

  it("rejects an unknown creation ID from a real Email.set call", async () => {
    const { client } = setup();
    const draft = client.api.Email.set({ create: { draft: { subject: "Hello" } } });
    expect(() => draft.created("missing" as "draft")).toThrow(RangeError);
    await draft;
  });

  it("only augments set methods", async () => {
    const { client } = setup();
    const query = client.api.Email.query({});
    expect(query).not.toHaveProperty("created");
    await query;
  });
});
