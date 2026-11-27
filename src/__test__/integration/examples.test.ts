// The flows on the examples page (docs/examples.md), run against Stalwart.
// The provisioned user sends to their own address, so every message is
// delivered back into the same account and the tests can find it.

import { describe, expect, inject, it, vi } from "vitest";

import { patch } from "../../patch.ts";
import { createClient, uniqueName } from "./client.ts";

const capabilities = ["mail", "submission", "vacationResponse"] as const;

async function prepare() {
  const client = createClient(...capabilities);
  const { username } = inject("stalwart");
  const [mailboxes, identities] = await Promise.all([
    client.api.Mailbox.query({ filter: { role: "drafts" } }),
    client.api.Identity.get({}),
  ]);
  const draftMailboxId = mailboxes.ids[0]!;
  const identity = identities.list.find((candidate) => candidate.email === username);
  if (!identity) {
    throw new Error(`No identity for ${username}: ${JSON.stringify(identities.list)}`);
  }
  return { client, draftMailboxId, identity, address: username };
}

type Client = Awaited<ReturnType<typeof prepare>>["client"];

/**
 * Wait for an email with the given subject to arrive in the inbox
 */
async function waitForDelivery(client: Client, subject: string): Promise<string> {
  const inbox = await client.api.Mailbox.query({ filter: { role: "inbox" } });
  const inboxId = inbox.ids[0]!;
  return vi.waitFor(
    async () => {
      const { ids } = await client.api.Email.query({
        filter: { operator: "AND", conditions: [{ inMailbox: inboxId }, { subject }] },
      });
      if (!ids[0]) {
        throw new Error(`"${subject}" was not delivered`);
      }
      return ids[0];
    },
    { timeout: 10_000, interval: 200 },
  );
}

describe("examples page", () => {
  it("sends an email and destroys the draft", async () => {
    const { client, draftMailboxId, identity, address } = await prepare();
    const subject = uniqueName("Hi there");

    const draft = client.api.Email.set({
      create: {
        draft: {
          keywords: { $draft: true },
          mailboxIds: { [draftMailboxId]: true },
          from: [{ name: identity.name, email: identity.email }],
          to: [{ name: null, email: address }],
          subject,
          bodyValues: { body: { value: "Hello there!\nI hope you are well." } },
          textBody: [{ partId: "body", type: "text/plain" }],
        },
      },
    });
    const submission = client.api.EmailSubmission.set({
      create: {
        submission: { emailId: draft.createdRef("draft"), identityId: identity.id },
      },
      onSuccessDestroyEmail: ["#submission"],
    });

    const [draftResult, submissionResult] = await Promise.all([draft, submission]);
    expect(submissionResult.notCreated).toBeFalsy();
    const draftId = draftResult.created!.draft!.id;

    const deliveredId = await waitForDelivery(client, subject);
    const [delivered, drafts] = await Promise.all([
      client.api.Email.get({
        ids: [deliveredId],
        properties: ["subject", "from", "to"],
        fetchTextBodyValues: true,
      }),
      client.api.Email.get({ ids: [draftId], properties: ["id"] }),
    ]);

    expect(delivered.list[0]).toMatchObject({
      subject,
      from: [{ email: identity.email }],
      to: [{ email: address }],
    });
    expect(drafts.notFound).toEqual([draftId]);
  });

  it("sends an uploaded file as an attachment", async () => {
    const { client, draftMailboxId, identity, address } = await prepare();
    const session = await client.session;
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:mail"]!;
    const subject = uniqueName("January report");
    const content = "month,total\nJanuary,42\n";

    const { blobId } = await client.blob.upload(new Blob([content], { type: "text/csv" }), {
      accountId,
    });
    const draft = client.api.Email.set({
      create: {
        draft: {
          keywords: { $draft: true },
          mailboxIds: { [draftMailboxId]: true },
          from: [{ name: identity.name, email: identity.email }],
          to: [{ name: null, email: address }],
          subject,
          bodyValues: { text: { value: "The report is attached." } },
          textBody: [{ partId: "text", type: "text/plain" }],
          attachments: [
            { blobId, type: "text/csv", name: "report.csv", disposition: "attachment" },
          ],
        },
      },
    });
    const submission = await client.api.EmailSubmission.set({
      create: {
        submission: { emailId: draft.createdRef("draft"), identityId: identity.id },
      },
      onSuccessDestroyEmail: ["#submission"],
    });
    expect(submission.notCreated).toBeFalsy();

    const deliveredId = await waitForDelivery(client, subject);
    const delivered = await client.api.Email.get({
      ids: [deliveredId],
      properties: ["attachments"],
    });
    const attachment = delivered.list[0]!.attachments[0]!;
    expect(attachment).toMatchObject({ name: "report.csv", type: "text/csv" });

    const download = await client.blob.download({
      accountId,
      blobId: attachment.blobId!,
      name: "report.csv",
      type: "text/csv",
    });
    await expect(download.text()).resolves.toBe(content);
  });

  it("replies to the newest email in the inbox, in the same thread", async () => {
    const { client, draftMailboxId, identity, address } = await prepare();
    const subject = uniqueName("Lunch");

    await client.api.EmailSubmission.set({
      create: {
        submission: {
          emailId: client.api.Email.set({
            create: {
              original: {
                keywords: { $draft: true },
                mailboxIds: { [draftMailboxId]: true },
                from: [{ name: identity.name, email: identity.email }],
                to: [{ name: null, email: address }],
                subject,
                bodyValues: { text: { value: "Lunch on Friday?" } },
                textBody: [{ partId: "text", type: "text/plain" }],
              },
            },
          }).createdRef("original"),
          identityId: identity.id,
        },
      },
      onSuccessDestroyEmail: ["#submission"],
    });
    const originalId = await waitForDelivery(client, subject);

    const getOriginal = await client.api.Email.get({
      ids: [originalId],
      properties: ["from", "replyTo", "subject", "messageId", "references", "threadId"],
    });
    const original = getOriginal.list[0]!;
    const inReplyTo = original.messageId!;

    const reply = client.api.Email.set({
      create: {
        reply: {
          keywords: { $draft: true },
          mailboxIds: { [draftMailboxId]: true },
          from: [{ name: identity.name, email: identity.email }],
          to: original.replyTo ?? original.from!,
          subject: `Re: ${original.subject}`,
          inReplyTo,
          references: [...(original.references ?? []), ...inReplyTo],
          bodyValues: { text: { value: "Thanks, that works for me." } },
          textBody: [{ partId: "text", type: "text/plain" }],
        },
      },
    });
    const submission = await client.api.EmailSubmission.set({
      create: {
        submission: { emailId: reply.createdRef("reply"), identityId: identity.id },
      },
      onSuccessDestroyEmail: ["#submission"],
    });
    expect(submission.notCreated).toBeFalsy();

    const replyId = await waitForDelivery(client, `Re: ${subject}`);
    const thread = await client.api.Thread.get({ ids: [original.threadId] });
    expect(thread.list[0]!.emailIds).toEqual(expect.arrayContaining([originalId, replyId]));
  });

  it("moves an email by replacing and by patching its mailboxes", async () => {
    const client = createClient("mail");
    const mailboxes = await client.api.Mailbox.set({
      create: {
        source: { name: uniqueName("Move source") },
        archive: { name: uniqueName("Move archive") },
      },
    });
    const sourceId = mailboxes.created!.source!.id;
    const archiveId = mailboxes.created!.archive!.id;
    const created = await client.api.Email.set({
      create: { email: { mailboxIds: { [sourceId]: true }, subject: "Move me" } },
    });
    const emailId = created.created!.email!.id;

    await client.api.Email.set({
      update: { [emailId]: { mailboxIds: { [archiveId]: true } } },
    });
    const replaced = await client.api.Email.get({ ids: [emailId], properties: ["mailboxIds"] });
    expect(replaced.list[0]!.mailboxIds).toEqual({ [archiveId]: true });

    await client.api.Email.set({
      update: {
        [emailId]: {
          mailboxIds: patch({ [archiveId]: null, [sourceId]: true }),
          keywords: patch({ $seen: true }),
        },
      },
    });
    const patched = await client.api.Email.get({
      ids: [emailId],
      properties: ["mailboxIds", "keywords"],
    });
    expect(patched.list[0]!.mailboxIds).toEqual({ [sourceId]: true });
    expect(patched.list[0]!.keywords).toMatchObject({ $seen: true });
  });

  it("turns a vacation response on and off", async () => {
    const client = createClient(...capabilities);

    const enabled = await client.api.VacationResponse.set({
      update: {
        singleton: {
          isEnabled: true,
          fromDate: "2026-12-22T00:00:00Z",
          toDate: "2027-01-05T00:00:00Z",
          subject: "Out of office",
          textBody: "I'm away until January 5 and will reply when I'm back.",
        },
      },
    });
    expect(enabled.notUpdated).toBeFalsy();

    const on = await client.api.VacationResponse.get({});
    expect(on.list[0]).toMatchObject({
      id: "singleton",
      isEnabled: true,
      subject: "Out of office",
    });

    await client.api.VacationResponse.set({ update: { singleton: { isEnabled: false } } });
    const off = await client.api.VacationResponse.get({ ids: ["singleton"] });
    expect(off.list[0]!.isEnabled).toBe(false);
  });
});
