# Examples

> TODO: State shared setup, required capabilities, and placeholder account/token values for the recipes.

## Find the Inbox

> TODO: Explain the result and handle an empty ids array.

```ts [TypeScript]
const mailboxes = await client.api.Mailbox.query({
  filter: {
    role: "inbox",
  },
  limit: 1,
});

const [inboxId] = mailboxes.ids;
```

## Read Inbox Emails

> TODO: Outline an Email/query plus Email/get recipe using .ref() and selected properties.

## Update an Email

> TODO: Outline changing a keyword with Email/set and checking updated/notUpdated.

## Upload and Download a Blob

> TODO: Outline a small upload/download recipe; link to Blobs.

## Watch for Changes

> TODO: Outline a state-change subscription with cleanup; link to Events.
