# Examples

These recipes assume the [installation and runtime prerequisites](./index.md),
a provider session endpoint, and an access token. Each TypeScript block is a
complete module; replace the endpoint, token, and any uppercase ID placeholders.
Read operations require a readable mail account; writes require the corresponding
permissions. [Method Calls](./features/method-calls.md) explains selected properties,
references, and per-object failures. Requests can reject; catch errors at your
application boundary using the [error guide](./reference/errors.md).

## Get the session

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});

const session = await client.session; // Fetch once, then reuse the cached promise.
console.log(session.accounts);
const refreshed = await client.refreshSession(); // Fetch and replace the cache.
console.log(refreshed.state);
```

Refreshing also lets you retry a failed cached session request. It does not alter
the capabilities configured on the client. See [Capabilities](./features/capabilities.md)
for choosing another account.

## Find the inbox

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const query = client.api.Mailbox.query({
  accountId,
  filter: { role: "inbox" },
  limit: 1,
});
const get = client.api.Mailbox.get({
  accountId,
  ids: query.resultRef("/ids"),
  properties: ["id", "name"],
});
const [, result] = await Promise.all([query, get]);
const inbox = result.list[0];
if (!inbox) throw new Error("No readable inbox found");
const inboxId = inbox.id;
console.log(inboxId, inbox.name);
```

`Mailbox.query` returns `ids`; `Mailbox.get` returns `list`. `inbox` above is a
mailbox object, while `inboxId` is its string ID.

## List unread emails

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const inboxes = await client.api.Mailbox.query({
  accountId,
  filter: { role: "inbox" },
  limit: 1,
});
const inboxId = inboxes.ids[0];
if (!inboxId) throw new Error("No inbox found");
const query = client.api.Email.query({
  accountId,
  filter: {
    operator: "AND",
    conditions: [
      { inMailbox: inboxId },
      { notKeyword: "$seen" },
      { notKeyword: "$draft" },
    ],
  },
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 10,
});
const get = client.api.Email.get({
  accountId,
  ids: query.resultRef("/ids"),
  properties: ["id", "from", "subject", "sentAt"],
});
const [matches, emails] = await Promise.all([query, get]);
if (matches.ids.length === 0)
  console.log("No unread messages");
for (const email of emails.list)
  console.log(
    email.id,
    email.from,
    email.subject,
    email.sentAt,
  );
if (emails.notFound?.length)
  console.warn("Messages disappeared", emails.notFound);
```

This reads one page. Use the [pagination iterator](./index.md#read-the-inbox-in-pages)
for subsequent anchors and termination. Keep page sizes within your server's limits.

## Send an email

Choose a mail account that also advertises the submission capability. The recipe
uses its first accessible identity; in an application let the user choose an
authorised identity. It requires writable Drafts and Sent mailboxes.

The draft and submission use creation IDs `draft` and `submission`, unique within
the request. The server resolves `#draft` to the newly created email. On successful
submission creation, `onSuccessUpdateEmail` moves the email to Sent and removes
`$draft`. The implicit filing update can fail independently, so the recipe checks
the stored email afterwards. It leaves a failed submission's draft available for
recovery. Submission creation means acceptance for sending, not confirmed delivery;
inspect `EmailSubmission/get` and delivery status when needed.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

if (
  !session.capabilities[
    "urn:ietf:params:jmap:submission"
  ] ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:submission"
  ]
) {
  throw new Error(
    "The selected mail account cannot submit email",
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
    "A drafts mailbox, sent mailbox, and authorised sending identity are required",
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
// The implicit Email/set response is not returned by EmailSubmission.set.
// Verify the requested filing operation with a separate get.
const filed = await client.api.Email.get({
  accountId,
  ids: [emailId],
  properties: ["id", "mailboxIds", "keywords"],
});
const saved = filed.list[0];
if (
  !saved ||
  !saved.mailboxIds[sentMailboxId] ||
  saved.keywords.$draft
) {
  throw new Error(
    "Submission was created, but Sent filing needs reconciliation; do not resend",
  );
}
console.log(
  "Submission created",
  submitted.created.submission.id,
  emailId,
);
```

Check `notCreated` even when both promises resolve. A failed draft creation may
also cause the submission to fail. Transport failure can leave the server outcome
unknown: reconcile the draft/submission before retrying to avoid duplicate mail.
Successful siblings are not rolled back. See
[RFC 8621 §7.5](https://jmap.io/spec/rfc8621/#section-7.5) for submission and the
implicit `Email/set`. If you deliberately want to delete the created email instead
of keeping a Sent copy, `onSuccessDestroyEmail: ["#submission"]` is the alternative;
do not combine it with an update of the same email.

## Send an attachment

Upload bytes into the **same account** used to create the email, then put the
returned `blobId` in an attachment body part. This example creates a small text
file; replace the `Blob` with a user-selected `File` in a browser. Upload size,
media type, CORS, download responses, and filename handling are covered in
[Blobs](./features/blobs.md).

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

if (
  !session.capabilities[
    "urn:ietf:params:jmap:submission"
  ] ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:submission"
  ]
) {
  throw new Error(
    "The selected mail account cannot submit email",
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
    "A drafts mailbox, sent mailbox, and authorised sending identity are required",
  );
}

const file = new Blob(["Report contents\n"], {
  type: "text/plain",
});
const uploaded = await client.blob.upload(file, {
  accountId,
});

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
      attachments: [
        {
          blobId: uploaded.blobId,
          type: uploaded.type,
          name: "report.txt",
          disposition: "attachment",
        },
      ],
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
// The implicit Email/set response is not returned by EmailSubmission.set.
// Verify the requested filing operation with a separate get.
const filed = await client.api.Email.get({
  accountId,
  ids: [emailId],
  properties: ["id", "mailboxIds", "keywords"],
});
const saved = filed.list[0];
if (
  !saved ||
  !saved.mailboxIds[sentMailboxId] ||
  saved.keywords.$draft
) {
  throw new Error(
    "Submission was created, but Sent filing needs reconciliation; do not resend",
  );
}
console.log(
  "Submission created",
  submitted.created.submission.id,
  emailId,
);
```

The upload is a separate HTTP request before the draft/submission batch. If email
creation fails, the upload has still happened; retry or cleanup policy is separate
from submitting the message.

## Reply to a thread

Start with an existing `EMAIL_ID` from the chosen account. A reply uses the
original message's `messageId` in `inReplyTo` and extends `references`; `threadId`
is server-assigned and cannot be set on a draft. The recipient is `replyTo` when
present, otherwise `from`. This is a direct reply, rather than reply-all.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

if (
  !session.capabilities[
    "urn:ietf:params:jmap:submission"
  ] ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:submission"
  ]
) {
  throw new Error(
    "The selected mail account cannot submit email",
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
    "A drafts mailbox, sent mailbox, and authorised sending identity are required",
  );
}

const originalResult = await client.api.Email.get({
  accountId,
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
const original = originalResult.list[0];
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

const draft = client.api.Email.set({
  accountId,
  create: {
    draft: {
      mailboxIds: { [draftMailboxId]: true },
      keywords: { $draft: true },
      from: [
        { name: identity.name, email: identity.email },
      ],
      to: recipients,
      subject: /^re:/i.test(subject)
        ? subject
        : `Re: ${subject}`,
      inReplyTo: original.messageId,
      references: [
        ...(original.references ?? []),
        ...original.messageId,
      ],
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
// The implicit Email/set response is not returned by EmailSubmission.set.
// Verify the requested filing operation with a separate get.
const filed = await client.api.Email.get({
  accountId,
  ids: [emailId],
  properties: ["id", "mailboxIds", "keywords"],
});
const saved = filed.list[0];
if (
  !saved ||
  !saved.mailboxIds[sentMailboxId] ||
  saved.keywords.$draft
) {
  throw new Error(
    "Submission was created, but Sent filing needs reconciliation; do not resend",
  );
}
console.log(
  "Submission created",
  submitted.created.submission.id,
  emailId,
);
```

The server determines thread grouping from the message headers under
[RFC 8621 §3](https://jmap.io/spec/rfc8621/#section-3). A reply does not force an
arbitrary `threadId`. If you also mark the original `$answered`, perform and check
a separate `Email/set` update after successful submission creation.

## Move an email

This recipe moves an email into the account's Archive mailbox, replacing all its
current mailbox memberships. The target must be writable. For a move from only one
source mailbox while preserving other memberships, read `mailboxIds` first and
construct the desired map (using `ifInState` to detect concurrent changes).

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const emailId = "EMAIL_ID";
const target = await client.api.Mailbox.query({
  accountId,
  filter: { role: "archive" },
  limit: 1,
});
const archiveId = target.ids[0];
if (!archiveId)
  throw new Error(
    "No archive mailbox found; choose a writable destination",
  );
const current = await client.api.Email.get({
  accountId,
  ids: [emailId],
  properties: ["id"],
});
if (!current.list[0])
  throw new Error("The email was not found");
const changed = await client.api.Email.set({
  accountId,
  ifInState: current.state,
  update: {
    [emailId]: { mailboxIds: { [archiveId]: true } },
  },
});
if (changed.notUpdated?.[emailId]) {
  throw new Error(
    JSON.stringify(changed.notUpdated[emailId]),
  );
}
if (
  !changed.updated ||
  !Object.hasOwn(changed.updated, emailId)
) {
  throw new Error("The server did not confirm the move");
}
console.log("Moved", emailId, archiveId);
```

A concurrent account change can cause `stateMismatch`; fetch current state and
reassess the intended move before retrying. Object errors such as `notFound` or
`forbidden` appear in `notUpdated`. See [Errors](./reference/errors.md).

## Get email attachments

Request attachment metadata, then download each attachment's blob. Selecting
`bodyProperties` explicitly ensures every consumed attachment field is present.
An empty attachment list is normal. Downloading returns a Fetch `Response`;
consume its body before saving or displaying it.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  auth: { token: "YOUR_ACCESS_TOKEN" },
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail", "submission"],
});
const session = await client.session;
const accountId =
  session.primaryAccounts["urn:ietf:params:jmap:mail"];
if (
  !accountId ||
  !session.accounts[accountId]?.accountCapabilities[
    "urn:ietf:params:jmap:mail"
  ]
) {
  throw new Error("No primary mail account is available");
}

const result = await client.api.Email.get({
  accountId,
  ids: ["EMAIL_ID"],
  properties: ["id", "attachments"],
  bodyProperties: ["blobId", "name", "type", "size"],
});
const email = result.list[0];
if (!email) throw new Error("The email was not found");
if (email.attachments.length === 0)
  console.log("No attachments");
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
  // Pass bytes to your browser save UI or Node.js filesystem code.
}
```

Transfers are sequential here to bound memory and concurrent downloads. If an
attachment vanishes, the download can fail even after a successful `Email/get`.
See [Blobs](./features/blobs.md) for saving in Node.js and browsers and for
untrusted filenames and MIME types.
