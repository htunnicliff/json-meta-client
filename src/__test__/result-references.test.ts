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
        if (!(input instanceof Request)) {
          throw new TypeError("Expected a Request");
        }
        const body: unknown = JSON.parse(await input.text());
        if (!isJmapRequest(body)) {
          throw new TypeError("Expected a JMAP request");
        }
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
  it("rejects a nested reference and sends the rest of the batch", async () => {
    const { client, requests } = setup();
    const mailboxes = client.api.Mailbox.query({});
    const emails = client.api.Email.query({
      // @ts-expect-error A reference can't be nested inside an argument.
      filter: { inMailbox: mailboxes.resultRef("/ids/0") },
    });

    await expect(emails).rejects.toBeInstanceOf(ResultReferenceError);
    await expect(emails).rejects.toMatchObject({ reason: "nested" });
    await mailboxes;
    expect(callIds(requests)).toEqual([[mailboxes.$id]]);
  });

  it("rejects an argument given both as a value and as a reference", async () => {
    const { client, requests } = setup();
    const query = client.api.Email.query({});
    const reference = { name: "Email/query", resultOf: query.$id, path: "/ids" };
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const get = client.api.Email.get({ ids: ["email"], "#ids": reference } as never);

    await expect(get).rejects.toMatchObject({ reason: "duplicate-argument" });
    await query;
    expect(callIds(requests)).toEqual([[query.$id]]);
  });

  it("rejects a reference to a method call from an earlier batch", async () => {
    const { client, requests } = setup();
    const query = client.api.Email.query({});
    await query;
    const get = client.api.Email.get({ ids: query.resultRef("/ids") });

    await expect(get).rejects.toMatchObject({ reason: "cross-batch" });
    expect(callIds(requests)).toEqual([[query.$id]]);
  });

  it("rejects a method call whose ID is already in its batch", async () => {
    const { client } = setup();
    const first = client.api.Email.query({}, { id: "same" });
    const second = client.api.Mailbox.query({}, { id: "same" });

    await expect(first).resolves.toEqual({ method: "Email/query" });
    await expect(second).rejects.toMatchObject({ reason: "duplicate-id" });
  });
});
