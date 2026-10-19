# Examples

## Find the Inbox

```ts [TypeScript]
const mailboxes = await client.api.Mailbox.query({
  filter: {
    role: "inbox",
  },
  limit: 1,
});

const [inboxId] = mailboxes.ids;
```
