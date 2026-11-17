// Search the inbox for messages containing a phrase.
const inbox = client.api.Mailbox.query({ filter: { role: "inbox" } });
const matches = client.api.Email.query({
  filter: { inMailbox: inbox.resultRef("/ids/0"), text: "invoice" },
  sort: [{ property: "receivedAt", isAscending: false }],
  limit: 20,
});
const emails = await client.api.Email.get({
  ids: matches.resultRef("/ids"),
  properties: ["id", "subject", "from", "receivedAt"],
});
for (const email of emails.list) console.log(email.subject, email.from);
