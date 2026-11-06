::: code-group

```ts {16} [Your code]
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
});

const unread = client.api.Email.query({
  accountId: "ACCOUNT_ID",
  filter: { notKeyword: "$seen" },
  limit: 5,
});
const emails = client.api.Email.get({
  accountId: "ACCOUNT_ID",
  ids: unread.resultRef("/ids"),
  properties: ["subject", "from"],
});

for (const email of (await emails).list) {
  console.log(email.subject);
}
```

```json {13-17} [Sent to the server]
{
  "using": ["urn:ietf:params:jmap:core", "urn:ietf:params:jmap:mail"],
  "methodCalls": [
    [
      "Email/query",
      { "accountId": "ACCOUNT_ID", "filter": { "notKeyword": "$seen" }, "limit": 5 },
      "Email/query::3fa9c01b"
    ],
    [
      "Email/get",
      {
        "accountId": "ACCOUNT_ID",
        "#ids": {
          "name": "Email/query",
          "resultOf": "Email/query::3fa9c01b",
          "path": "/ids"
        },
        "properties": ["subject", "from"]
      },
      "Email/get::8e21d4a7"
    ]
  ]
}
```

:::
