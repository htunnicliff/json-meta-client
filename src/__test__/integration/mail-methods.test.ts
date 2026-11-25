// Mail and submission methods beyond the basic get, set, and query round
// trips.

import { describe, expect, it, vi } from "vitest";

import { createClient, uniqueName } from "./client.ts";

const rfc822 = (subject: string) =>
  [
    "From: Ada <ada@example.test>",
    "To: integration@example.test",
    `Subject: ${subject}`,
    "Message-ID: <" + crypto.randomUUID() + "@example.test>",
    "Date: Wed, 25 Nov 2026 12:00:00 +0000",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "The quarterly numbers are in.",
    "",
  ].join("\r\n");

async function mailAccount(client: ReturnType<typeof createClient<["mail"]>>) {
  const session = await client.session;
  return session.primaryAccounts["urn:ietf:params:jmap:mail"]!;
}

async function createMailbox(client: ReturnType<typeof createClient<["mail"]>>, prefix: string) {
  const result = await client.api.Mailbox.set({
    create: { box: { name: uniqueName(prefix) } },
  });
  return result.created!.box!.id;
}

describe("mail methods", () => {
  it("parses an uploaded message, then imports it and gets its thread", async () => {
    const client = createClient("mail");
    const accountId = await mailAccount(client);
    const mailboxId = await createMailbox(client, "Import");
    const subject = uniqueName("Quarterly numbers");
    const { blobId } = await client.blob.upload(
      new Blob([rfc822(subject)], { type: "message/rfc822" }),
      { accountId },
    );

    const parsed = await client.api.Email.parse({
      blobIds: [blobId],
      properties: ["subject", "from"],
    });
    expect(parsed.parsed?.[blobId]).toMatchObject({
      subject,
      from: [{ name: "Ada", email: "ada@example.test" }],
    });

    const imported = await client.api.Email.import({
      emails: {
        message: {
          blobId,
          mailboxIds: { [mailboxId]: true },
          keywords: { $seen: true },
          receivedAt: "2026-11-25T12:00:00Z",
        },
      },
    });
    expect(imported.notCreated).toBeFalsy();
    const { id: emailId, threadId } = imported.created!.message!;

    const threads = await client.api.Thread.get({ ids: [threadId] });
    expect(threads.list).toEqual([{ id: threadId, emailIds: [emailId] }]);
  });

  it("gets search snippets for a text search", async () => {
    const client = createClient("mail");
    const mailboxId = await createMailbox(client, "Snippets");
    const word = `zephyr${crypto.randomUUID().slice(0, 8)}`;
    await client.api.Email.set({
      create: {
        email: {
          mailboxIds: { [mailboxId]: true },
          subject: `About the ${word} project`,
          bodyValues: { text: { value: `The ${word} project ships next week.` } },
          textBody: [{ partId: "text", type: "text/plain" }],
        },
      },
    });

    // Stalwart indexes text in the background, so wait for the search to find it
    const filter = {
      operator: "AND" as const,
      conditions: [{ inMailbox: mailboxId }, { text: word }],
    };
    const ids = await vi.waitFor(
      async () => {
        const result = await client.api.Email.query({ filter });
        expect(result.ids).toHaveLength(1);
        return result.ids;
      },
      { timeout: 10_000, interval: 200 },
    );

    const snippets = await client.api.SearchSnippet.get({ filter, emailIds: ids });

    expect(snippets.list).toEqual([
      expect.objectContaining({ emailId: ids[0], subject: expect.stringContaining(word) }),
    ]);
  });

  it("reports mailbox and email changes since a state", async () => {
    const client = createClient("mail");
    const mailboxId = await createMailbox(client, "Changes");
    const [mailboxState, emailState] = await Promise.all([
      client.api.Mailbox.get({ ids: [] }).then((result) => result.state),
      client.api.Email.get({ ids: [] }).then((result) => result.state),
    ]);

    const renamed = client.api.Mailbox.set({
      update: { [mailboxId]: { name: uniqueName("Changes renamed") } },
    });
    const created = client.api.Email.set({
      create: { email: { mailboxIds: { [mailboxId]: true }, subject: "Changed" } },
    });
    const [, emailResult] = await Promise.all([renamed, created]);
    const emailId = emailResult.created!.email!.id;

    const [mailboxChanges, emailChanges] = await Promise.all([
      client.api.Mailbox.changes({ sinceState: mailboxState }),
      client.api.Email.changes({ sinceState: emailState }),
    ]);

    expect(mailboxChanges.oldState).toBe(mailboxState);
    expect([...mailboxChanges.created, ...mailboxChanges.updated]).toContain(mailboxId);
    expect(emailChanges.oldState).toBe(emailState);
    expect(emailChanges.created).toContain(emailId);
  });

  it("reports query changes since a query state", async () => {
    const client = createClient("mail");
    const mailboxId = await createMailbox(client, "Query changes");
    const filter = { inMailbox: mailboxId };
    const sort = [{ property: "receivedAt" as const, isAscending: false }];
    const before = await client.api.Email.query({ filter, sort });
    expect(before.ids).toEqual([]);

    const created = await client.api.Email.set({
      create: { email: { mailboxIds: { [mailboxId]: true }, subject: "Added" } },
    });
    const emailId = created.created!.email!.id;

    const changes = await client.api.Email.queryChanges({
      filter,
      sort,
      sinceQueryState: before.queryState,
    });

    expect(changes.oldQueryState).toBe(before.queryState);
    expect(changes.added).toEqual([{ id: emailId, index: 0 }]);
  });

  it("creates, updates, and destroys an identity", async () => {
    const client = createClient("mail", "submission");
    const identities = await client.api.Identity.get({});
    const email = identities.list[0]!.email;
    const name = uniqueName("Integration");

    const created = await client.api.Identity.set({
      create: { identity: { name, email } },
    });
    expect(created.notCreated).toBeFalsy();
    const identityId = created.created!.identity!.id;

    const updated = await client.api.Identity.set({
      update: { [identityId]: { textSignature: "-- \nSent from the integration suite" } },
    });
    expect(updated.notUpdated).toBeFalsy();

    const got = await client.api.Identity.get({ ids: [identityId] });
    expect(got.list[0]).toMatchObject({
      name,
      email,
      textSignature: "-- \nSent from the integration suite",
    });

    const destroyed = await client.api.Identity.set({ destroy: [identityId] });
    expect(destroyed.destroyed).toEqual([identityId]);
  });

  it("queries and gets email submissions", async () => {
    const client = createClient("mail", "submission");
    const [identities, drafts] = await Promise.all([
      client.api.Identity.get({}),
      client.api.Mailbox.query({ filter: { role: "drafts" } }),
    ]);
    const identity = identities.list[0]!;
    const draft = client.api.Email.set({
      create: {
        draft: {
          keywords: { $draft: true },
          mailboxIds: { [drafts.ids[0]!]: true },
          from: [{ name: identity.name, email: identity.email }],
          to: [{ name: null, email: identity.email }],
          subject: uniqueName("Submission"),
          bodyValues: { text: { value: "Tracked." } },
          textBody: [{ partId: "text", type: "text/plain" }],
        },
      },
    });
    const submitted = await client.api.EmailSubmission.set({
      create: {
        submission: { emailId: draft.createdRef("draft"), identityId: identity.id },
      },
    });
    const submissionId = submitted.created!.submission!.id;

    const query = client.api.EmailSubmission.query({
      filter: { identityIds: [identity.id] },
    });
    const submissions = await client.api.EmailSubmission.get({
      ids: query.resultRef("/ids"),
      properties: ["identityId", "undoStatus"],
    });

    expect(submissions.list).toContainEqual({
      id: submissionId,
      identityId: identity.id,
      undoStatus: expect.any(String),
    });
  });
});
