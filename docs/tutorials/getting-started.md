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

### Find the Inbox

```ts
const mailboxesQuery = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

const [inboxId] = mailboxesQuery.ids;
```

Here's the underlying JMAP request that gets sent:

```json
{
  "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
  "methodCalls": [
    [
      "Mailbox/query",
      {
        "filter": {
          "role": "inbox"
        },
        "limit": 1,
        "accountId": "********"
      },
      "Mailbox/query::f2d3db2f-4fdc-4a4f-95b5-89676e50022f"
    ]
  ]
}
```

And the JMAP response:

```json
{
  "sessionState": "**********",
  "methodResponses": [
    [
      "Mailbox/query",
      {
        "canCalculateChanges": true,
        "position": 0,
        "filter": {
          "role": "inbox"
        },
        "ids": ["****"],
        "accountId": "********",
        "total": 1,
        "queryState": "********"
      },
      "Mailbox/query::f2d3db2f-4fdc-4a4f-95b5-89676e50022f"
    ]
  ]
}
```

A few notes:

- The client automatically sets the `accountId` to the primary account, but it can also be set manually.
- The client generates method call IDs by joining the method call name with a cryptographically random UUID (`<Entity>/<Method>::${crypto.randomUUID()}`)

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

<details>
<summary>JMAP request</summary>

```json
{
  "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
  "methodCalls": [
    [
      "Email/query",
      {
        "filter": {
          "inMailbox": "****"
        },
        "limit": 25,
        "accountId": "********"
      },
      "Email/query::55e592be-da32-44f1-b25a-8cc2138a99d8"
    ],
    [
      "Email/get",
      {
        "#ids": {
          "name": "Email/query",
          "resultOf": "Email/query::55e592be-da32-44f1-b25a-8cc2138a99d8",
          "path": "/ids"
        },
        "properties": ["to", "from", "subject", "sentAt"],
        "accountId": "********"
      },
      "Email/get::6f162eb6-e55e-4720-9dd0-cba7dd6c96a8"
    ]
  ]
}
```

</details>

<details>
<summary>JMAP response</summary>

```jsonc
{
  "sessionState": "*******",
  "methodResponses": [
    [
      "Email/query",
      {
        "canCalculateChanges": true,
        "collapseThreads": false,
        "filter": {
          "inMailbox": "****",
        },
        "ids": [
          "StmB7E05NAYF",
          "StmDp8WT_r-3",
          "StmEiKVRFtGN",
          "StmG1GN4f03k",
          "StmG8pVqxdAF",
          "StmMWpZUxCW-",
        ],
        "accountId": "********",
        "total": 6,
        "queryState": "******",
        "position": 0,
      },
      "Email/query::55e592be-da32-44f1-b25a-8cc2138a99d8",
    ],
    [
      "Email/get",
      {
        "accountId": "********",
        "state": "*****",
        "list": [
          {
            "subject": "An example subject",
            "sentAt": "2026-10-09T20:52:49Z",
            "to": [
              {
                "name": null,
                "email": "example@example.com",
              },
            ],
            "from": [
              {
                "name": "Someone",
                "email": "someone@example.com",
              },
            ],
            "id": "StmB7E05NAYF",
          },
          {
            "subject": "Another neat example subject",
            "sentAt": "2026-10-07T10:52:49Z",
            "to": [
              {
                "name": null,
                "email": "example@example.com",
              },
            ],
            "from": [
              {
                "name": "Someone else",
                "email": "someone_else@example.net",
              },
            ],
            "id": "StmB7E05NAYF",
          },
        ],
        "notFound": [],
      },
      "Email/get::6f162eb6-e55e-4720-9dd0-cba7dd6c96a8",
    ],
  ],
}
```

</details>
