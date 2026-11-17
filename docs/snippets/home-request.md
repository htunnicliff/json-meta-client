::: code-group

```ts [TypeScript ~vscode-icons:file-type-typescript~]
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "<server>/.well-known/jmap",
  auth: "<token>",
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
      "Email/query::f3c9ebfd"
    ],
    [
      "Email/get",
      {
        "#ids": {
          "name": "Email/query",
          "resultOf": "Email/query::f3c9ebfd",
          "path": "/ids"
        },
        "properties": ["subject", "from"],
        "accountId": "<account-id>"
      },
      "Email/get::2b30f05c"
    ]
  ]
}
```

:::
