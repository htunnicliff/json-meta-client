# Mail recipes

Use these recipes when you know the mail operation you want to perform. If you
are connecting for the first time, start with the [first-request tutorial](./getting-started.md).
Each TypeScript block is a complete module. Replace the session URL, token,
and uppercase ID placeholders with values from your provider and account.

Keep related objects in the same account. Reads require access to the objects;
writes also require the appropriate permissions. The
[account guide](./features/capabilities.md) shows how to check advertised support.
Catch request failures at your application's operation boundary, and inspect
per-object errors before reporting a write as successful.

## Get the session

Read `client.session` to get account information and service URLs. The first
read fetches it; later reads share the cached promise. Use `refreshSession()`
when you need new metadata, or to retry a failed cached session request:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const session = await client.session;
console.log(session.accounts);

const fresh = await client.refreshSession();
console.log(fresh.state);
```

Refreshing does not change the capabilities configured on the client.

## Find the inbox

Query the mailbox's role rather than its name, which can vary by provider or
language. A result reference lets the server pass the query's IDs to the get
in the same request:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const query = client.api.Mailbox.query({
  accountId: "ACCOUNT_ID",
  filter: { role: "inbox" },
  limit: 1,
});
const get = client.api.Mailbox.get({
  accountId: "ACCOUNT_ID",
  ids: query.resultRef("/ids"),
  properties: ["id", "name"],
});
const [, result] = await Promise.all([query, get]);
const inbox = result.list[0];
if (!inbox) throw new Error("No readable inbox was found");
console.log(inbox.id, inbox.name);
```

Keep `inbox.id` for message queries. The query's `ids` are strings; the get's
`list` contains mailbox objects.

## List unread emails

Filter messages by the inbox ID and absence of `$seen`. This recipe also
excludes drafts, orders messages by arrival time, and reads the first ten:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const query = client.api.Email.query({
  accountId: "ACCOUNT_ID",
  filter: {
    operator: "AND",
    conditions: [
      { inMailbox: "INBOX_ID" },
      { notKeyword: "$seen" },
      { notKeyword: "$draft" },
    ],
  },
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 10,
});
const get = client.api.Email.get({
  accountId: "ACCOUNT_ID",
  ids: query.resultRef("/ids"),
  properties: ["id", "from", "subject", "sentAt"],
});
const [, emails] = await Promise.all([query, get]);
for (const email of emails.list) {
  console.log(
    email.id,
    email.from,
    email.subject,
    email.sentAt,
  );
}
if (emails.notFound?.length)
  console.warn("Messages disappeared", emails.notFound);
```

An empty list is normal when no messages match. For more than one page, use
an iterator like the one below and retain the unread filter if you need it.

## Read the inbox in pages

Anchor each page after the last ID from the previous **query**, even when some
objects disappear before the get. Stop on an empty query page, rather than on
a short page: the server may return fewer objects than the requested limit.

This helper accepts `client.api`, the account ID, and the inbox ID. Choose a
page size within the server's `maxObjectsInGet` and query limits; each page also
needs room for two method calls in a request.

```ts
import type { ClientApi } from "json-meta-client";

export async function* readInbox(
  api: ClientApi<readonly ["mail"]>,
  accountId: string,
  inboxId: string,
  limit = 10,
) {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Use a positive page size");
  }
  let anchor: string | undefined;
  const seen = new Set<string>();
  for (;;) {
    const query = api.Email.query({
      accountId,
      filter: { inMailbox: inboxId },
      sort: [
        { property: "receivedAt", isAscending: false },
      ],
      ...(anchor
        ? { anchor, anchorOffset: 1 }
        : { position: 0 }),
      limit,
    });
    const get = api.Email.get({
      accountId,
      ids: query.resultRef("/ids"),
      properties: ["id", "from", "subject", "receivedAt"],
    });
    const [page, emails] = await Promise.all([query, get]);
    if (page.ids.length === 0) return;

    for (const email of emails.list) {
      if (!seen.has(email.id)) {
        seen.add(email.id);
        yield email;
      }
    }
    if (emails.notFound?.length)
      console.warn("Messages disappeared", emails.notFound);
    const next = page.ids.at(-1);
    if (next === anchor)
      throw new Error("Pagination did not advance");
    anchor = next;
  }
}
```

Consume it with `for await (const email of readInbox(client.api, accountId, inboxId))`.
The explicit `receivedAt` sort gives the pages a consistent order; JMAP requires
the tie order to remain stable for equal values. A vanished anchor or another
method failure rejects the iterator.

A live inbox can still change while you read it. This iterator suppresses
duplicate IDs, but a new message inserted before the anchor may be missed.
Restart or use query-change synchronisation when you need to reconcile concurrent
changes. The `seen` set grows with the number of messages read; this is a
bounded-page example, not a constant-memory snapshot.

## Send an email

Sending requires both `"mail"` and `"submission"` on one account. The example
checks the primary mail account, finds Drafts and Sent mailboxes, and uses the
first accessible sending identity. In an application, let the user choose an
authorised identity and recipient before submitting.

Creating an Email stores a draft. Creating an EmailSubmission asks the server
to send it. The two calls below share a request, with a creation reference
connecting the submission to its draft:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const mail = "urn:ietf:params:jmap:mail";
const submissionCapability =
  "urn:ietf:params:jmap:submission";
const accountId = session.primaryAccounts[mail];
const account = accountId
  ? session.accounts[accountId]
  : undefined;
if (
  !accountId ||
  account?.isReadOnly ||
  !session.capabilities[mail] ||
  !session.capabilities[submissionCapability] ||
  !account?.accountCapabilities[mail] ||
  !account.accountCapabilities[submissionCapability]
) {
  throw new Error(
    "A writable account with mail and submission support is required",
  );
}

const [drafts, sent, identities] = await Promise.all([
  client.api.Mailbox.query({
    accountId,
    filter: { role: "drafts" },
    limit: 1,
  }),
  client.api.Mailbox.query({
    accountId,
    filter: { role: "sent" },
    limit: 1,
  }),
  client.api.Identity.get({ accountId, ids: null }),
]);
const draftMailboxId = drafts.ids[0];
const sentMailboxId = sent.ids[0];
const identity = identities.list[0];
if (!draftMailboxId || !sentMailboxId || !identity) {
  throw new Error(
    "Drafts, Sent, and a sending identity are required",
  );
}

const draft = client.api.Email.set({
  accountId,
  create: {
    draft: {
      mailboxIds: { [draftMailboxId]: true },
      keywords: { $draft: true },
      from: [
        { name: identity.name, email: identity.email },
      ],
      to: [{ name: null, email: "recipient@example.com" }],
      subject: "Hello from JMAP",
      bodyValues: { body: { value: "Hello!" } },
      textBody: [{ partId: "body", type: "text/plain" }],
    },
  },
});
const submission = client.api.EmailSubmission.set({
  accountId,
  create: {
    submission: {
      emailId: draft.createdRef("draft"),
      identityId: identity.id,
    },
  },
  onSuccessUpdateEmail: {
    "#submission": {
      mailboxIds: { [sentMailboxId]: true },
      "keywords/$draft": null,
    },
  },
});
const [created, submitted] = await Promise.all([
  draft,
  submission,
]);
const emailId = created.created?.draft?.id;
if (!emailId || !submitted.created?.submission) {
  throw new Error(
    JSON.stringify({
      draft: created.notCreated,
      submission: submitted.notCreated,
    }),
  );
}

const filed = await client.api.Email.get({
  accountId,
  ids: [emailId],
  properties: ["id", "mailboxIds", "keywords"],
});
const saved = filed.list[0];
if (
  !saved?.mailboxIds[sentMailboxId] ||
  saved.keywords.$draft
) {
  throw new Error(
    "Submission created; Sent filing needs reconciliation. Do not resend.",
  );
}
console.log(
  "Submission created",
  submitted.created.submission.id,
  emailId,
);
```

Both mailboxes must permit the requested writes. `onSuccessUpdateEmail` asks
the server to file the accepted draft in Sent and remove `$draft`. Its
`"#submission"` key refers to the submission's creation ID. Keep all creation
IDs unique within the request.

The filing update can fail separately from submission creation. The client
returns the matching EmailSubmission result, not the implicit Email/set result,
so the recipe reads the email afterwards to verify filing. A filing problem
needs reconciliation; sending the message again could duplicate it. If you
intend to delete the email after submission instead, use
`onSuccessDestroyEmail: ["#submission"]` and do not also update that email.

A successful submission means acceptance for sending, not confirmed delivery.
Inspect `EmailSubmission.get` and delivery status when required. If either set
contains `notCreated`, retain the draft and inspect the failure. If the HTTP
response is lost, inspect server state before retrying: the server may already
have created the draft or submission. Successful sibling operations are not
rolled back.

## Send an attachment

Upload the file to the same account used by the sending recipe. Then add its
blob metadata to `create.draft.attachments` in the Email/set call. This complete
upload example prepares that array:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const uploaded = await client.blob.upload(
  new Blob(["Report contents\n"], { type: "text/plain" }),
  { accountId: "ACCOUNT_ID" },
);
export const attachments = [
  {
    blobId: uploaded.blobId,
    type: uploaded.type,
    name: "report.txt",
    disposition: "attachment" as const,
  },
];
```

Use `attachments` as the draft's `attachments` value, then create and verify
the submission as in [Send an email](#send-an-email). In a browser, a
user-selected `File` can replace the example's `Blob`.

The upload is a separate HTTP request before the draft and submission. If
creation fails, the upload has still happened. The
[file transfer guide](./features/blobs.md) covers body types, media types, and
transfer failures.

## Reply to a thread

A reply uses message headers to relate itself to the original email. Read
`messageId`, `references`, and the reply address; do not try to set `threadId`,
which the server assigns. This example prepares the fields for a direct reply,
using `replyTo` when available and `from` otherwise:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const result = await client.api.Email.get({
  accountId: "ACCOUNT_ID",
  ids: ["EMAIL_ID"],
  properties: [
    "id",
    "subject",
    "replyTo",
    "from",
    "messageId",
    "references",
  ],
});
const original = result.list[0];
if (!original)
  throw new Error("The original email was not found");
const recipients = original.replyTo?.length
  ? original.replyTo
  : original.from;
if (!recipients?.length || !original.messageId?.length) {
  throw new Error(
    "The original email needs a reply address and Message-ID",
  );
}
const subject = original.subject ?? "";
export const reply = {
  to: recipients,
  subject: /^re:/i.test(subject)
    ? subject
    : `Re: ${subject}`,
  inReplyTo: original.messageId,
  references: [
    ...(original.references ?? []),
    ...original.messageId,
  ],
};
```

In the sending recipe, spread `...reply` into `create.draft` after its `to` and
`subject` fields, and set the reply's body. Use the same account and an
authorised sender identity, then create and check the submission. This sends a
direct reply; reply-all needs its own recipient selection and deduplication.

The server determines thread grouping from the headers, so these fields cannot
force a particular thread ID. To mark the original as `$answered`, perform and
check a separate Email/set update after successful submission creation.

## Move an email

Replace `mailboxIds` to move a message to one destination and remove all its
previous mailbox memberships. The recipe below targets the Archive role; that
mailbox must allow the write. If you want to remove only one membership while
keeping others, fetch `mailboxIds` and construct the desired map instead.

Read the current state and send it as `ifInState` to detect intervening changes:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const accountId = "ACCOUNT_ID";
const emailId = "EMAIL_ID";
const target = await client.api.Mailbox.query({
  accountId,
  filter: { role: "archive" },
  limit: 1,
});
const archiveId = target.ids[0];
if (!archiveId)
  throw new Error("Choose a writable destination mailbox");

const current = await client.api.Email.get({
  accountId,
  ids: [emailId],
  properties: ["id"],
});
if (!current.list[0])
  throw new Error("The email was not found");
const result = await client.api.Email.set({
  accountId,
  ifInState: current.state,
  update: {
    [emailId]: { mailboxIds: { [archiveId]: true } },
  },
});
if (result.notUpdated?.[emailId]) {
  throw new Error(
    JSON.stringify(result.notUpdated[emailId]),
  );
}
if (
  !result.updated ||
  !Object.hasOwn(result.updated, emailId)
) {
  throw new Error("The server did not confirm the move");
}
console.log("Moved", emailId, archiveId);
```

An account change can cause `stateMismatch`. Read current state and reassess the
move before retrying. Object-specific failures, such as `forbidden` or
`notFound`, appear in `notUpdated`; see [errors](./reference/errors.md).

## Get email attachments

Read the attachment metadata, selecting the body-part fields needed for the
download. Each attachment's `blobId` can then be passed to `client.blob.download`:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});
const accountId = "ACCOUNT_ID";
const result = await client.api.Email.get({
  accountId,
  ids: ["EMAIL_ID"],
  properties: ["id", "attachments"],
  bodyProperties: ["blobId", "name", "type", "size"],
});
const email = result.list[0];
if (!email) throw new Error("The email was not found");

for (const attachment of email.attachments) {
  if (!attachment.blobId)
    throw new Error(
      "Attachment has no downloadable blob ID",
    );
  const name = attachment.name ?? "attachment";
  const response = await client.blob.download({
    accountId,
    blobId: attachment.blobId,
    name,
    type: attachment.type,
  });
  const bytes = await response.arrayBuffer();
  console.log(name, attachment.type, bytes.byteLength);
}
```

An empty attachment list needs no downloads. Transfers run sequentially here to
bound memory and concurrency. An attachment can disappear after the successful
Email/get, so handle download and body-reading failures too. Pass the bytes to
your application's save or preview UI; the [blob guide](./features/blobs.md#consume-a-download-response)
covers response readers and safe filename handling.
