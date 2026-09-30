import { JmapError, ref } from "json-meta-client";

import { client } from "./client.ts";

try {
  const inboxes = await client.api.Mailbox.query({ filter: { role: "inbox" }, limit: 1 });
  const inboxId = inboxes.ids[0];
  if (!inboxId) throw new Error("No inbox found");

  const query = client.api.Email.query({ filter: { inMailbox: inboxId }, limit: 10 });
  const messages = client.api.Email.get({
    ids: ref(query, "/ids"),
    properties: ["id", "subject", "from", "threadId"],
  });
  const threads = client.api.Thread.get({
    ids: ref(messages, "/list/*/threadId"),
    properties: ["id", "emailIds"],
  });
  const [emails, threadData] = await Promise.all([messages, threads]);
  console.log(emails.list, threadData.list);

  const mailboxes = client.api.Mailbox.get({ properties: ["id", "name"] });
  const identities = client.api.Identity.get({ properties: ["id", "name", "email"] });
  const [mailboxData, identityData] = await Promise.all([mailboxes, identities]);
  console.log(mailboxData.list, identityData.list);
  const echoed = await client.api.Core.echo({ greeting: "hello" });
  console.log(echoed.greeting);
} catch (error) {
  if (JmapError.isJmapError(error)) console.error(error.type, error.detail);
  else if (error instanceof Error) console.error(error.message);
  else console.error(error);
  process.exitCode = 1;
}
