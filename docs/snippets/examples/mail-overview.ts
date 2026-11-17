// Kitchen sink: batch mailbox discovery, a filtered query, and message retrieval.
// Result references keep dependent calls in one JMAP request.
const inbox = client.api.Mailbox.query({ filter: { role: "inbox" } });
const unread = client.api.Email.query({
  filter: { notKeyword: "$seen" },
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 10,
});
const [mailboxes, emails] = await Promise.all([
  client.api.Mailbox.get({
    ids: inbox.resultRef("/ids"),
    properties: ["id", "name", "role"],
  }),
  client.api.Email.get({
    ids: unread.resultRef("/ids"),
    properties: ["id", "subject", "from", "receivedAt", "keywords"],
  }),
]);
console.log("Mailboxes", mailboxes.list);
console.log("Recent unread messages", emails.list);
