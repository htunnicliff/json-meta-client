import type { EmailAddress } from "jmap-rfc-types";
import { expectTypeOf, test } from "vitest";

import { Client, KNOWN_CAPABILITIES, ref } from "../index.ts";

test("demo", async () => {
  const client = new Client({
    bearerToken: "process.env.BEARER_TOKEN!",
    sessionUrl: "process.env.SESSION_URL!",
    capabilities: [...KNOWN_CAPABILITIES],
  });

  const {
    ids: [inboxId],
  } = await client.api.Mailbox.query({
    filter: { role: "inbox" },
  });

  const emailsQuery = client.api.Email.query({
    filter: {
      inMailbox: inboxId,
    },
  });

  const emails = await client.api.Email.get({
    ids: ref(emailsQuery, "/ids"),
    properties: ["header:Received:asText:all", "from"],
  });

  type EmailItem = (typeof emails.list)[number];
  expectTypeOf<EmailItem>().toEqualTypeOf<{
    "header:Received:asText:all": string[];
    from: EmailAddress[];
  }>();
});
