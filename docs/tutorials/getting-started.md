# Getting Started

## Recommended Ingredients

- **This library**: Download `json-meta-client` from NPM using your preferred package manager (e.g. pnpm, npm, or yarn).
- **A session URL**: Find the session URL exposed by your JMAP provider.

> [!TIP]
> Some providers support autodiscovery of the session URL via `/.well-known/jmap` (e.g. `https://my-jmap-provider.net/.well-known/jmap`)

- **A bearer token**: You'll need to procure a bearer token from your JMAP provider in order to authenticate your JMAP requests. Sometimes called a personal access token, app token, or API token, you'll typically be able to create one in your account settings.

## Configuring a Client

With those ingredients in hand, begin by configuring a client.

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  bearerToken: "<bearer-token>",
  sessionUrl: "<session-url>",
  capabilities: ["mail", "submission", "contacts"],
});
```

When configuring a client, you'll need to choose which capabilities you plan on using. Capabilities vary based what your JMAP server supports—some may offer a wide range (e.g. `vacationResponse`, `contacts`, `sieve`), while others may be more limited (e.g. `core`, `mail`, `submission`).

<details>
<summary>Here are the capabilities offered out of the box by <code>json-meta-client</code>:</summary>

- **core**
  - URN: _urn:ietf:params:jmap:core_
  - `Core`
  - `Blob`
  - `PushSubscription`
- **mail**
  - URN: _urn:ietf:params:jmap:mail_
  - `Mailbox`
  - `Thread`
  - `Email`
  - `SearchSnippet`
- **submission**
  - URN: _urn:ietf:params:jmap:submission_
  - `Identity`
  - `EmailSubmission`
- **vacationResponse**
  - URN: _urn:ietf:params:jmap:vacationresponse_
  - `VacationResponse`
- **blob**
  - URN: _urn:ietf:params:jmap:blob_
  - `Blob`
- **contacts**
  - URN: _urn:ietf:params:jmap:contacts_
  - `AddressBook`
  - `ContactCard`
- **sieve**
  - URN: _urn:ietf:params:jmap:sieve_
  - `SieveScript`
- **community:maskedEmail**
  - URN: _https://<span>www.fastmail.com/dev/maskedemail</span>_
  - `MaskedEmail`

</details>

> [!NOTE]
> The client can support any kind of capability. See the [custom capabilities documentation](./TODO) for more details.

> [!TIP]
> If a JMAP server does not support a requested capability, the client will log a warning after your first session request.

Each capability chosen will make its corresponding entities and their methods available via the client's `api`:

```ts
client.api.Email.get(/*...*/);
client.api.EmailSubmission.queryChanges(/*...*/);
client.api.ContactCard.set(/*...*/);
// client.api.<Entity>.<method>(<args>);
```

## Making Requests

Let's make a few requests together to see how things work.

### Find The Inbox

```ts
const mailboxesQuery = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

const [inboxId] = mailboxesQuery.ids;
```

Here's the underlying JMAP request that gets sent:

```json

```

### Get the First 10 Emails in the Inbox

```ts
const emailsQuery = client.api.Email.query({
  filter: { inMailbox: inboxId },
  limit: 10,
});

const emails = await client.api.Email.get({
  ids: emailsQuery.ref("/ids"),
  properties: ["to", "from", "subject", "sentAt"],
});

for (const email of emails.list) {
  const { to, from, subject, sentAt } = email;

  console.log({
    to,
    from,
    subject,
    sentAt,
  });
}
```
