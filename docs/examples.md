# Examples

:::warning IN PROGRESS
These docs are not yet complete.
:::

Each example shows the TypeScript you write alongside the JMAP request the
client sends for it. Each TypeScript example starts by creating a client;
replace the session URL and token with values from your provider, and see the
[first-request tutorial](./getting-started.md) for other ways to authenticate.
Uppercase placeholders such as `INBOX_ID` stand in for values an earlier
example finds. Account IDs are redacted in the request bodies.

## Get the session

The session describes the accounts you can use and the capabilities the server
supports. Reading `client.session` fetches it on first use and then returns the
cached copy. Call `refreshSession()` when you need current data from the server,
such as after account access changes.

::: code-group

```ts [example.ts]
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

// Get the current session (cached)
await client.session;

// Get a fresh session
await client.refreshSession();
```

:::

## Find the inbox

Mailbox names vary between providers and languages, so find the inbox by its
`inbox` role instead. The get uses a result reference to read the query's IDs,
which lets the client send both calls in a single request:

::: code-group

```ts [example.ts]
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

const queryMailboxes = client.api.Mailbox.query({
  filter: { role: "inbox" },
});

const getMailboxes = await client.api.Mailbox.get({
  ids: queryMailboxes.resultRef("/ids"),
  properties: ["id", "name"],
});

const inboxId = getMailboxes.list[0]?.id;

for (const mailbox of getMailboxes.list) {
  console.log(mailbox.id, mailbox.name);
}
```

```json [request.json]
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail"
  ],
  "methodCalls": [
    [
      "Mailbox/query",
      {
        "filter": {
          "role": "inbox"
        },
        "accountId": "*********"
      },
      "Mailbox/query::33f05dca"
    ],
    [
      "Mailbox/get",
      {
        "#ids": {
          "name": "Mailbox/query",
          "resultOf": "Mailbox/query::33f05dca",
          "path": "/ids"
        },
        "properties": ["id", "name"],
        "accountId": "*********"
      },
      "Mailbox/get::8094dff8"
    ]
  ]
}
```

:::

## List unread emails

JMAP marks a message as read with the `$seen` keyword. This query matches
messages in the inbox that have neither `$seen` nor `$draft`, then a result
reference passes the matching IDs to the get:

::: code-group

```ts [example.ts]
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

// The inbox ID from the previous example
const inboxId = "INBOX_ID";

const queryEmails = client.api.Email.query({
  filter: {
    operator: "AND",
    conditions: [
      { inMailbox: inboxId },
      { notKeyword: "$seen" },
      { notKeyword: "$draft" },
    ],
  },
});

const getEmails = await client.api.Email.get({
  ids: queryEmails.resultRef("/ids"),
  properties: ["from", "subject", "sentAt"],
});

for (const email of getEmails.list) {
  console.log(email);
}
```

```json [request.json]
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail"
  ],
  "methodCalls": [
    [
      "Email/query",
      {
        "filter": {
          "operator": "AND",
          "conditions": [
            { "inMailbox": "P-F" },
            { "notKeyword": "$seen" },
            { "notKeyword": "$draft" }
          ]
        },
        "accountId": "*********"
      },
      "Email/query::6f7adf07"
    ],
    [
      "Email/get",
      {
        "#ids": {
          "name": "Email/query",
          "resultOf": "Email/query::6f7adf07",
          "path": "/ids"
        },
        "properties": [
          "to",
          "from",
          "subject",
          "sentAt",
          "keywords"
        ],
        "accountId": "*********"
      },
      "Email/get::c2ef5d19"
    ]
  ]
}
```

:::

## Send an email

Sending takes two steps. First, store the message as a draft in the Drafts
mailbox. Then create an email submission, which asks the server to deliver the
draft from one of your identities. Both steps need the `submission` capability
as well as `mail`.

### Prep

Find the ID of the Drafts mailbox and choose an identity to send from. The
mailbox query and identity get are independent, so they can share a request:

::: code-group

```ts [prep.ts]
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail", "submission"],
});

const [mailboxes, identities] = await Promise.all([
  client.api.Mailbox.query({
    filter: { role: "drafts" },
  }),
  client.api.Identity.get({
    ids: undefined, // Omitting `ids` fetches every identity
  }),
]);

const draftMailboxId = mailboxes.ids[0];
const identity = identities.list[0];
```

```json [request.json]
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail",
    "urn:ietf:params:jmap:submission"
  ],
  "methodCalls": [
    [
      "Mailbox/query",
      {
        "filter": {
          "role": "drafts"
        },
        "accountId": "*********"
      },
      "Mailbox/query::7478d066"
    ],
    [
      "Identity/get",
      {
        "accountId": "*********"
      },
      "Identity/get::f33ce75b"
    ]
  ]
}
```

:::

### Draft and send

Each object in `create` has a creation ID that you choose, such as `draft` and
`submission` below. The server reports results under these IDs, and later calls
in the same request can refer to the new object before it has a server ID.
Short, descriptive creation IDs make requests easier to read while debugging.

Here, `draft.createdRef("draft")` points the submission at the email created by
the first call. `onSuccessDestroyEmail` removes the draft once the server
accepts the submission, so it does not remain in Drafts:

::: code-group

```ts [draft-and-send.ts]
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail", "submission"],
});

// Values found in the prep step
const draftMailboxId = "DRAFTS_MAILBOX_ID";
const identity = {
  id: "IDENTITY_ID",
  name: "Me",
  email: "me@example.com",
};

const bodyId = "body";

const draft = client.api.Email.set({
  create: {
    draft: {
      // Ensure the email is a draft
      keywords: { $draft: true },

      // Put the draft in the drafts mailbox
      mailboxIds: { [draftMailboxId]: true },

      // Typical email fields
      from: [
        { name: identity.name, email: identity.email },
      ],
      to: [{ name: null, email: "someone@example.com" }],
      subject: "Hi there",

      // Set the body
      bodyValues: {
        [bodyId]: {
          value:
            "Hello there!\nI hope you are well.\nBest,\nMe",
        },
      },
      textBody: [
        {
          partId: bodyId,
          type: "text/plain",
        },
      ],
    },
  },
});

await client.api.EmailSubmission.set({
  create: {
    // Send the email that was created
    submission: {
      emailId: draft.createdRef("draft"),
      identityId: identity.id,
    },
  },

  // Delete the draft if it is sent successfully
  onSuccessDestroyEmail: ["#submission"],
});
```

```json [request.json]
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail",
    "urn:ietf:params:jmap:submission"
  ],
  "methodCalls": [
    [
      "Email/set",
      {
        "create": {
          "draft": {
            "keywords": { "$draft": true },
            "mailboxIds": { "P2k": true },
            "from": [
              { "name": "**", "email": "****************" }
            ],
            "to": [
              {
                "name": null,
                "email": "someone@example.com"
              }
            ],
            "subject": "Hi there",
            "bodyValues": {
              "body": {
                "value": "Hello there!\nI hope you are well.\nBest,\nMe"
              }
            },
            "textBody": [
              {
                "partId": "body",
                "type": "text/plain"
              }
            ]
          }
        },
        "accountId": "*********"
      },
      "Email/set::e6af7055"
    ],
    [
      "EmailSubmission/set",
      {
        "create": {
          "submission": {
            "emailId": "#draft",
            "identityId": "123634456"
          }
        },
        "onSuccessDestroyEmail": ["#submission"],
        "accountId": "*********"
      },
      "EmailSubmission/set::ac3e2f7c"
    ]
  ]
}
```

:::

## Send an attachment <Badge type="warning" text="To do" />

::: code-group

```ts [example.ts]
// TODO
```

```json [request.json]
{}
```

:::

## Reply to a thread <Badge type="warning" text="To do" />

::: code-group

```ts [example.ts]
// TODO
```

```json [request.json]
{}
```

:::

## Move an email <Badge type="warning" text="To do" />

::: code-group

```ts [example.ts]
// TODO
```

```json [request.json]
{}
```

:::

## Get email attachments <Badge type="warning" text="To do" />

::: code-group

```ts [example.ts]
// TODO
```

```json [request.json]
{}
```

:::
