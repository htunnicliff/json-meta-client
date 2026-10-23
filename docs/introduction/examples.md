# Examples

These recipes use the mail client from [Getting started](./getting-started.md). IDs in angle brackets are placeholders for values from your account.

## Find the inbox

Mailbox roles identify standard folders without relying on their display names.

```ts
const result = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

const [inboxId] = result.ids;
if (!inboxId) {
  throw new Error("This account has no inbox mailbox");
}
```

Keep `inboxId` for the next recipe. A successful query may return no IDs, so check before using the first result.

## Read recent inbox messages

Filter by the inbox ID, sort newest first, and fetch only the fields needed for a message list:

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

const [, messages] = await Promise.all([query, get]);
for (const message of messages.list) {
  console.log(message.receivedAt, message.from, message.subject);
}
```

The two methods share one request. `Promise.all()` observes failures from both promises, including a query failure that prevents the server from resolving the reference.

## Mark a message as read

Use a JMAP patch path to set one keyword without replacing the message's other keywords:

```ts
const emailId = "<email-id>";
const result = await client.api.Email.set({
  update: {
    [emailId]: { "keywords/$seen": true },
  },
});

const failure = result.notUpdated?.[emailId];
if (failure) {
  console.error("Could not update the message:", failure);
} else if (result.updated && Object.hasOwn(result.updated, emailId)) {
  console.log("Message marked as read");
}
```

A set call can resolve successfully while individual changes fail. Inspect the relevant `notCreated`, `notUpdated`, or `notDestroyed` map, as well as handling a rejected method promise.

## Round-trip a text file

```ts
const upload = await client.blob.upload(
  new Blob(["A note from my application"], { type: "text/plain" }),
);

const download = await client.blob.download({
  accountId: upload.accountId,
  blobId: upload.blobId,
  name: "note.txt",
  type: upload.type,
});

console.log(await download.text());
```

The upload stores bytes and returns a blob ID. Creating a message or attaching the blob to a record requires the appropriate JMAP method as a separate step. See [Blobs](../features/blobs.md).

## Listen for mail changes

```ts
const controller = new AbortController();

await client.onStateChange(
  (error, change) => {
    if (error) {
      console.error("Could not process a notification:", error);
      return;
    }

    if (change.isPrimaryAccount && change.entity === "Email") {
      console.log("Mail has changed; refresh the message list", change.state);
    }
  },
  { signal: controller.signal },
);

// Run during view or application cleanup.
controller.abort();
```

The notification carries a state token, not the changed records. Refresh your query or use `Email/changes` with a previously saved data state. The [events guide](../features/events.md) explains which state tokens to keep and how to clean up a subscription.
