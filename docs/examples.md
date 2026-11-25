# Examples

These examples use the `client` configured in
[Introduction](./getting-started.md#configuration), and each builds on the
values found by the examples before it.

## Get the session

The client fetches the session once and caches it. Call `refreshSession()`
to fetch it again, for example after the server reports a new session state.

```ts
// Get the current session (cached)
const session = await client.session;

// Get a fresh session
const freshSession = await client.refreshSession();
```

## Find the inbox

```ts
const queryMailboxes = client.api.Mailbox.query({
  filter: { role: "inbox" },
});

const getMailboxes = await client.api.Mailbox.get({
  ids: queryMailboxes.resultRef("/ids"),
  properties: ["id", "name"],
});

const inboxId = getMailboxes.list[0]!.id;

for (const mailbox of getMailboxes.list) {
  console.log(mailbox.id, mailbox.name);
}
```

## List unread emails

```ts
const queryEmails = client.api.Email.query({
  filter: {
    operator: "AND",
    conditions: [
      { inMailbox: inboxId },
      { notKeyword: "$seen" },
      { notKeyword: "$draft" },
    ],
  },
});

const getEmails = await client.api.Email.get({
  ids: queryEmails.resultRef("/ids"),
  properties: ["from", "subject", "sentAt"],
});

for (const email of getEmails.list) {
  console.log(email);
}
```

## Send an email

### Prep

Before sending, the drafts mailbox and the sending identity must be known.

```ts
const [mailboxes, identities] = await Promise.all([
  client.api.Mailbox.query({
    filter: { role: "drafts" },
  }),
  // Leaving out `ids` gets every identity
  client.api.Identity.get(),
]);

const draftMailboxId = mailboxes.ids[0]!;
const identity = identities.list[0]!;
```

### Draft and send

::: note
Local IDs are used to help clients identify results returned
by `/set` operations. These IDs can be any arbitrary string value.
:::

::: tip
It can be a good idea to use short, unambiguous strings
that are easily identifiable for debugging purposes.
:::

```ts
const bodyId = "body";

const draft = client.api.Email.set({
  create: {
    draft: {
      // Ensure the email is a draft
      keywords: { $draft: true },

      // Put the draft in the drafts mailbox
      mailboxIds: { [draftMailboxId]: true },

      // Typical email fields
      from: [
        { name: identity.name, email: identity.email },
      ],
      to: [{ name: null, email: "someone@example.com" }],
      subject: "Hi there",

      // Set the body
      bodyValues: {
        [bodyId]: {
          value:
            "Hello there!\nI hope you are well.\nBest,\nMe",
        },
      },
      textBody: [
        {
          partId: bodyId,
          type: "text/plain",
        },
      ],
    },
  },
});

await client.api.EmailSubmission.set({
  create: {
    // Send the email that was created
    submission: {
      emailId: draft.createdRef("draft"),
      identityId: identity.id,
    },
  },

  // Delete the draft if it is sent successfully
  onSuccessDestroyEmail: ["#submission"],
});
```

## Send an attachment

### Upload the file

Upload the file's contents first. Blob transfers always name their account,
so read the mail account from the session.

```ts
const mailAccountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"]!;

const report = new Blob(["month,total\nJanuary,42\n"], {
  type: "text/csv",
});

const { blobId: reportBlobId } = await client.blob.upload(
  report,
  { accountId: mailAccountId },
);
```

### Attach and send

Refer to the upload by its `blobId` in the draft's `attachments`, then send
the draft as before.

```ts
const attachmentDraft = client.api.Email.set({
  create: {
    draft: {
      keywords: { $draft: true },
      mailboxIds: { [draftMailboxId]: true },
      from: [
        { name: identity.name, email: identity.email },
      ],
      to: [{ name: null, email: "someone@example.com" }],
      subject: "January report",
      bodyValues: {
        text: { value: "The report is attached." },
      },
      textBody: [{ partId: "text", type: "text/plain" }],
      attachments: [
        {
          blobId: reportBlobId,
          type: "text/csv",
          name: "report.csv",
          disposition: "attachment",
        },
      ],
    },
  },
});

await client.api.EmailSubmission.set({
  create: {
    submission: {
      emailId: attachmentDraft.createdRef("draft"),
      identityId: identity.id,
    },
  },
  onSuccessDestroyEmail: ["#submission"],
});
```

## Reply to an email

### Get the original

Get the headers a reply needs from the newest email in the inbox: who to
reply to, the subject, and the message IDs that place the reply in the
conversation.

```ts
const queryNewest = client.api.Email.query({
  filter: { inMailbox: inboxId },
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 1,
});

const getNewest = await client.api.Email.get({
  ids: queryNewest.resultRef("/ids"),
  properties: [
    "from",
    "replyTo",
    "subject",
    "messageId",
    "references",
  ],
});

const original = getNewest.list[0]!;

const replyRecipients = original.replyTo ?? original.from!;
const replySubject = `Re: ${original.subject}`;
const inReplyTo = original.messageId!;
const references = [
  ...(original.references ?? []),
  ...inReplyTo,
];
```

### Draft and send the reply

Set `inReplyTo` to the original's `messageId`, and `references` to the
original's `references` followed by its `messageId`. Servers use these
headers to put the reply in the original's thread, and so do the
recipients' mail apps.

```ts
const replyDraft = client.api.Email.set({
  create: {
    reply: {
      keywords: { $draft: true },
      mailboxIds: { [draftMailboxId]: true },
      from: [
        { name: identity.name, email: identity.email },
      ],
      to: replyRecipients,
      subject: replySubject,
      inReplyTo,
      references,
      bodyValues: {
        text: { value: "Thanks, that works for me." },
      },
      textBody: [{ partId: "text", type: "text/plain" }],
    },
  },
});

await client.api.EmailSubmission.set({
  create: {
    submission: {
      emailId: replyDraft.createdRef("reply"),
      identityId: identity.id,
    },
  },
  onSuccessDestroyEmail: ["#submission"],
});
```

## Move an email

### Find the email and its destination

```ts
const [archives, newest] = await Promise.all([
  client.api.Mailbox.query({
    filter: { role: "archive" },
  }),
  client.api.Email.query({
    filter: { inMailbox: inboxId },
    sort: [{ property: "receivedAt", isAscending: false }],
    limit: 1,
  }),
]);

const archiveId = archives.ids[0]!;
const emailId = newest.ids[0]!;
```

### Move it

An email belongs to every mailbox in its `mailboxIds`. To move it, replace
`mailboxIds` with the destination:

```ts
await client.api.Email.set({
  update: {
    [emailId]: {
      mailboxIds: { [archiveId]: true },
    },
  },
});
```

On servers that use mailboxes as labels, an email can be in several at
once. To change only the memberships you name, patch them instead: `null`
removes the email from a mailbox, and `true` adds it. Other mailboxes the
email is in stay as they are.

```ts
import { patchMap } from "json-meta-client";

await client.api.Email.set({
  update: {
    [emailId]: patchMap("mailboxIds", {
      [inboxId]: null,
      [archiveId]: true,
    }),
  },
});
```

[`patchMap()`](./reference/api.md#patchmap) turns the IDs into patch
paths such as `mailboxIds/<id>`. The patch type checks the map name and
each value, so a misspelled `mailboxIdz`, or `false` in place of `null`, is
a type error.

## Mark an email as read

Keywords are patched the same way as mailboxes. Set `keywords/$seen` to
`true` to mark an email as read, or to `null` to mark it as unread.

```ts
await client.api.Email.set({
  update: {
    [emailId]: { "keywords/$seen": true },
  },
});
```

## Get email attachments

### Find the attachments

Ask for the `attachments` property, and use `bodyProperties` to choose
which details each attachment includes.

```ts
const queryWithAttachments = client.api.Email.query({
  filter: { inMailbox: inboxId, hasAttachment: true },
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 1,
});

const getWithAttachments = await client.api.Email.get({
  ids: queryWithAttachments.resultRef("/ids"),
  properties: ["attachments"],
  bodyProperties: ["blobId", "name", "type", "size"],
});

const attachment =
  getWithAttachments.list[0]!.attachments[0]!;
```

### Download one

Pass the attachment's `blobId` and `type` to `client.blob.download`, with the
mail account and a file name. It resolves to the server's
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response), so
read the body in whatever form you need.

```ts
const download = await client.blob.download({
  accountId: mailAccountId,
  blobId: attachment.blobId!,
  type: attachment.type,
  name: attachment.name ?? "attachment",
});

const contents = await download.blob();
```

## Search emails

The `text` filter of `Email/query` looks for words in an email's
addresses, subject, and body. To show why each email matched, pass the same
filter to `SearchSnippet/get` with the query's IDs. Each snippet's `subject`
and `preview` are HTML, with the matching words wrapped in `<mark>` tags.
Either is `null` when the server has no snippet to show for it.

```ts
const searchEmails = client.api.Email.query({
  filter: { text: "invoice" },
  limit: 10,
});

const getSnippets = await client.api.SearchSnippet.get({
  filter: { text: "invoice" },
  emailIds: searchEmails.resultRef("/ids"),
});

for (const snippet of getSnippets.list) {
  console.log(
    snippet.emailId,
    snippet.subject,
    snippet.preview,
  );
}
```

## Keep emails in sync

Every `/get` response includes a `state`. Keep the latest one, and when the
server reports an `Email` change, ask `Email/changes` for what happened
since then. Result references fetch the created and updated emails in the
same request.

```ts
let emailState = getEmails.state;

void client.onStateChange(async (error, change) => {
  if (
    error ||
    change.entity !== "Email" ||
    !change.isPrimaryAccount
  ) {
    return;
  }

  const emailChanges = client.api.Email.changes({
    sinceState: emailState,
  });

  const [changes, created, updated] = await Promise.all([
    emailChanges,
    client.api.Email.get({
      ids: emailChanges.resultRef("/created"),
      properties: ["from", "subject", "receivedAt"],
    }),
    client.api.Email.get({
      ids: emailChanges.resultRef("/updated"),
      properties: ["keywords", "mailboxIds"],
    }),
  ]);

  emailState = changes.newState;

  console.log("Created", created.list);
  console.log("Updated", updated.list);
  console.log("Destroyed", changes.destroyed);
});
```

The server can return only some of the changes, for example when you pass
`maxChanges`. When `hasMoreChanges` is `true`, call `Email/changes` again
with the new state until it is `false`. See [Events](./features/events.md) for more on the handler.

## Set a vacation response

The vacation response needs the `vacationResponse` capability. Each account
has one, with the ID `singleton`, which you update to turn it on or off.

```ts
import { JsonMetaClient } from "json-meta-client";

const vacationClient = new JsonMetaClient({
  auth: "<credentials>",
  sessionUrl: "<server>/.well-known/jmap",
  capabilities: ["mail", "submission", "vacationResponse"],
});

await vacationClient.api.VacationResponse.set({
  update: {
    singleton: {
      isEnabled: true,
      fromDate: "2026-12-22T00:00:00Z",
      toDate: "2027-01-05T00:00:00Z",
      subject: "Out of office",
      textBody:
        "I'm away until January 5 and will reply when I'm back.",
    },
  },
});
```

To turn it off, update `isEnabled` to `false`.
