# Examples

:::warning IN PROGRESS
These docs are not yet complete.
:::

## Get the session

::: code-group

```ts [example.ts]
// Get the current session (cached)
await client.session;

// Get a fresh session
await client.refreshSession();
```

:::

## Find the inbox

::: code-group

```ts [example.ts]
const queryMailboxes = client.api.Mailbox.query({
  filter: { role: "inbox" },
});

const getMailboxes = await client.api.Mailbox.get({
  ids: queryMailboxes.resultRef("/ids"),
  properties: ["id", "name"],
});

const [inboxId] = getMailboxes.list;

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

::: code-group

```ts [example.ts]
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

### Prep

Before sending, the drafts mailbox and the sending identity must be known.

::: code-group

```ts [prep.ts]
const [mailboxes, identities] = await Promise.all([
  client.api.Mailbox.query({
    filter: { role: "drafts" },
  }),
  client.api.Identity.get({
    ids: undefined, // Passing empty `ids` fetches everything
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

::: note
Local IDs are used to help clients identify results returned
by `/set` operations. These IDs can be any arbitrary string value.
:::

::: tip
It can be a good idea to use short, unambiguous strings
that are easily identifiable for debugging purposes.
:::

::: code-group

```ts [draft-and-send.ts]
const bodyId = "body";

const draft = client.api.Email.set({
  create: {
    draft: {
      // Ensure the email is a draft
      keywords: { $draft: true },

      // Put the draft in the drafts mailbox
      mailboxIds: { [draftMailboxId]: true },

      // Typical email fields
      from: [{ email: identity.email }],
      to: [{ email: "someone@example.com" }],
      subject: "Hi there",

      // Set the body
      bodyValues: {
        [bodyId]: {
          value:
            "Hello there!\nI hope you are well.\nBest,\nMe",
          charset: "utf-8",
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
            "from": [{ "email": "****************" }],
            "to": [{ "email": "someone@example.com" }],
            "subject": "Hi there",
            "bodyValues": {
              "body": {
                "value": "Hello there!\nI hope you are well.\nBest,\nMe",
                "charset": "utf-8"
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
