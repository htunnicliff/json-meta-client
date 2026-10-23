# Result references

A result reference passes data between methods inside a JMAP request. Instead of downloading a result and sending part of it back, you tell the server which earlier result to read.

## Fetch records from a query

```ts
const query = client.api.Email.query({ limit: 5 });
const messages = await client.api.Email.get({
  ids: query.ref("/ids"),
  properties: ["subject", "receivedAt"],
});
```

`query.ref("/ids")` describes the `ids` field of the query response. It does not read that field in JavaScript. The server runs the query, resolves the reference, and passes the resulting array to `Email/get`.

Keep the original method promise to call `.ref()`. After awaiting the query, use the ordinary `result.ids` value for a later request.

## Choose a pointer

Pointers start at the response arguments, without the surrounding JMAP response tuple.

| Pointer      | Meaning                                   |
| ------------ | ----------------------------------------- |
| `/ids`       | The entire `ids` field                    |
| `/list/0/id` | The first record's ID                     |
| `/list/*/id` | IDs collected from every record in `list` |

The wildcard is JMAP's extension to JSON Pointer. TypeScript checks supported paths against the response type and carries the selected value's type into the receiving argument. The server still needs to find that data at runtime: an empty list, for example, has no first record.

## Understand the request representation

For the query/get example, the client replaces the `ids` argument with `#ids`:

```json
{
  "#ids": {
    "resultOf": "<query-call-id>",
    "name": "Email/query",
    "path": "/ids"
  }
}
```

`resultOf` names the earlier call, `name` identifies its method response, and `path` selects the value. The client supplies these fields from the source promise.

The reference middleware also rewrites keys inside nested objects. A server must explicitly support references in those locations; use top-level arguments such as `ids` for the standard JMAP pattern.

## Keep references within a request

Create the source first and the receiving call second, synchronously on the same client. An intervening `await` can flush the source into an earlier request, making the reference unusable. Calls on different clients have different queues.

A source failure or invalid pointer can produce a JMAP error for the dependent method as well. Each call has its own promise and error outcome. See [Batching](./batching.md) and [Errors](../reference/errors.md).
