# Examples

These recipes assume a `client` created as shown in [Getting Started](./getting-started.md), with the `mail` capability. Replace placeholder IDs with values from your provider. Each recipe builds on the preceding values where noted.

## Find the Inbox

```ts
const mailboxes = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

const [inboxId] = mailboxes.ids;
if (!inboxId) {
  throw new Error("No inbox found in this account");
}
```

A successful query can return an empty `ids` array. Check it before using the inbox ID.

## Read Inbox Emails

Using `inboxId` from the previous recipe:

```ts
const query = client.api.Email.query({
  filter: { inMailbox: inboxId },
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 10,
});
const get = client.api.Email.get({
  ids: query.ref("/ids"),
  properties: ["subject", "from", "receivedAt"],
});

const [, emails] = await Promise.all([query, get]);
for (const email of emails.list) {
  console.log(email.subject, email.from, email.receivedAt);
}
```

This fetches up to ten recent inbox emails in one method-call request. See [Result References](../features/result-references.md).

## Mark an Email as Read

Patch the `$seen` keyword while leaving other keywords unchanged:

```ts
const emailId = "<email-id>";
const result = await client.api.Email.set({
  update: {
    [emailId]: { "keywords/$seen": true },
  },
});

if (result.notUpdated?.[emailId]) {
  console.error(result.notUpdated[emailId]);
} else if (result.updated && Object.hasOwn(result.updated, emailId)) {
  console.log("Marked as read");
}
```

Per-record failures are part of the successful response, so check `notUpdated` even when the promise resolves. See [Errors](../reference/errors.md).

## Upload and Download a Blob

```ts
const uploaded = await client.blob.upload(new Blob(["Hello, JMAP!"], { type: "text/plain" }));

const response = await client.blob.download({
  accountId: uploaded.accountId,
  blobId: uploaded.blobId,
  name: "hello.txt",
  type: uploaded.type,
});

console.log(await response.text());
```

Uploading stores a blob; it does not create an email or attachment record. See [Blobs](../features/blobs.md).

## Watch for Changes

```ts
const controller = new AbortController();

await client.onStateChange(
  (error, change) => {
    if (error) {
      console.error(error);
      return;
    }

    if (change.entity === "Email" && change.isPrimaryAccount) {
      console.log("Email data changed:", change.state);
    }
  },
  { signal: controller.signal },
);

// Call when the view or application no longer needs updates:
controller.abort();
```

The notification does not contain email records. Use a saved data-type state with `Email/changes`, or rerun a query, to fetch updates. See [Events](../features/events.md) for state tokens and cleanup.
