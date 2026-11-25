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
            ({ httpRequest: request }) => {
              if (request.url === sessionUrl) {
                sessionFetches.push(request.url);
              }
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
