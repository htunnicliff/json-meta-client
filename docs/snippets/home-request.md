::: code-group

```ts [TypeScript ~vscode-icons:file-type-typescript~]
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "<server>",
  auth: "<credentials>",
  capabilities: ["mail"],
});

const unread = client.api.Email.query({
  filter: { notKeyword: "$seen" },
  limit: 5,
});

const emails = await client.api.Email.get({
  ids: unread.resultRef("/ids"),
  properties: ["subject", "from"],
});

for (const { subject, from } of emails.list) {
  console.log(subject, from);
}
```

```json [JMAP Request ~vscode-icons:file-type-light-json~] {jmap:generated}
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
          "notKeyword": "$seen"
        },
        "limit": 5,
        "accountId": "<account-id>"
      },
      "unread"
    ],
    [
      "Email/get",
      {
        "#ids": {
          "name": "Email/query",
          "resultOf": "unread",
          "path": "/ids"
        },
        "properties": ["subject", "from"],
        "accountId": "<account-id>"
      },
      "emails"
    ]
  ]
}
```

:::
