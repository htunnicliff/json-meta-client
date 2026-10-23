# Examples

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
  ids: queryMailboxes.ref("/ids"),
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
      "Mailbox/query::33f05dca-6c62-499d-9dd8-86cfbecc1c1c"
    ],
    [
      "Mailbox/get",
      {
        "#ids": {
          "name": "Mailbox/query",
          "resultOf": "Mailbox/query::33f05dca-6c62-499d-9dd8-86cfbecc1c1c",
          "path": "/ids"
        },
        "properties": ["id", "name"],
        "accountId": "*********"
      },
      "Mailbox/get::8094dff8-4f6a-4ffa-a16b-95d87f34641d"
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
  ids: queryEmails.ref("/ids"),
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
      "Email/query::6f7adf07-3acb-44c7-9bb3-eea4294278fc"
    ],
    [
      "Email/get",
      {
        "#ids": {
          "name": "Email/query",
          "resultOf": "Email/query::6f7adf07-3acb-44c7-9bb3-eea4294278fc",
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
      "Email/get::c2ef5d19-35d9-46e6-8917-4a2f3ebbcf42"
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
      "Mailbox/query::7478d066-7714-44e5-b050-d6a17b48d7e4"
    ],
    [
      "Identity/get",
      {
        "accountId": "*********"
      },
      "Identity/get::f33ce75b-c4b6-49d4-a712-b4f36b262a8e"
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
const local = {
  emailId: "my-email",
  bodyId: "my-body",
  submissionId: "my-submission",
};

client.api.Email.set({
  create: {
    [local.emailId]: {
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
        [local.bodyId]: {
          value:
            "Hello there!\nI hope you are well.\nBest,\nMe",
          charset: "utf-8",
        },
      },
      textBody: [
        {
          partId: local.bodyId,
          type: "text/plain",
        },
      ],
    },
  },
});

await client.api.EmailSubmission.set({
  create: {
    // Send the email that was created
    [local.submissionId]: {
      emailId: `#${local.emailId}`,
      identityId: identity.id,
    },
  },

  // Delete the draft if it is sent successfully
  onSuccessDestroyEmail: [`#${local.submissionId}`],
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
          "my-email": {
            "keywords": { "$draft": true },
            "mailboxIds": { "P2k": true },
            "from": [{ "email": "****************" }],
            "to": [{ "email": "someone@example.com" }],
            "subject": "Hi there",
            "bodyValues": {
              "my-body": {
                "value": "Hello there!\nI hope you are well.\nBest,\nMe",
                "charset": "utf-8"
              }
            },
            "textBody": [
              {
                "partId": "my-body",
                "type": "text/plain"
              }
            ]
          }
        },
        "accountId": "*********"
      },
      "Email/set::e6af7055-3bc4-436a-9da9-6f6d5778b7bb"
    ],
    [
      "EmailSubmission/set",
      {
        "create": {
          "my-submission": {
            "emailId": "#my-email",
            "identityId": "123634456"
          }
        },
        "onSuccessDestroyEmail": ["#my-submission"],
        "accountId": "*********"
      },
      "EmailSubmission/set::ac3e2f7c-7d67-4e1e-ba54-5f41df26ee5a"
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
