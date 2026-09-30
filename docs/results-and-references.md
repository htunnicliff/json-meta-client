# Results and result references

An API call returns a promise with `id`, `method`, and `args` metadata.
Await it to receive the method's data. The client handles the JMAP
response envelope and matches each response to its promise by call ID.

Use `ref(pendingCall, pointer)` to pass part of a pending result to
another method in the same request. Queue the source first, followed
by its dependents, before the [batch flush](batching.md#where-a-batch-ends).
The server resolves the dependency, so the client can send the calls together:

```ts
import { ref } from "json-meta-client";

const query = client.api.Email.query({ limit: 10 });
const messages = client.api.Email.get({
  ids: ref(query, "/ids"),
  properties: ["id", "subject", "threadId"],
});
const threads = client.api.Thread.get({
  ids: ref(messages, "/list/*/threadId"),
  properties: ["id", "emailIds"],
});
const [emails, threadData] = await Promise.all([messages, threads]);
```

Here, the email get uses the query's IDs, and the thread get uses
the emails' thread IDs. Built-in middleware converts
`ids: ref(query, "/ids")` to the protocol argument
`"#ids": { name: "Email/query", resultOf: query.id, path: "/ids" }`.
It also handles references in nested objects. Several calls can reuse
a reference; constructing one does not fetch or await its source.

## Pointer paths

Paths use JMAP's extended JSON Pointer syntax:

| Path               | Selection                                       |
| ------------------ | ----------------------------------------------- |
| `/ids`             | The query result's ID array                     |
| `/list/0/id`       | The first returned object's ID                  |
| `/list/*/id`       | An ID array collected from all returned objects |
| `/list/*/threadId` | The thread IDs of returned emails               |

The `*` extension selects each array element and collects the
selected values. Ordinary JSON Pointer escaping uses `~0` for `~`
and `~1` for `/` in property names. The server evaluates paths and
reports invalid references as JMAP method errors. The type layer
supports common named properties, numeric indices, and array
wildcards, but does not fully model every JSON Pointer escaping
case. A result typed as `unknown` yields an unknown reference value. Contracts
using `any` provide less type checking.

For typed results, `ref()` restricts paths to known properties and
carries the selected value's type into the receiving argument.
Requesting selected properties with `get` also restricts the paths
to that selection. The public `Ref`, `AllowRefs`, and `UnpackRefs`
types support capability contracts. Construct references with
`ref()` rather than assembling plain JSON objects; the client
recognizes references created by its helper.

## Request scope

A reference and its source must be in the same request. `ref()` does
not check their batch membership or move calls between batches. If
the source has already been sent, await it and pass the returned
data to the next call. Within a batch, [request splitting](request-limits.md)
keeps references with their sources or rejects groups that cannot fit.
See
[RFC 8620 section 3.7](https://www.rfc-editor.org/rfc/rfc8620.html#section-3.7)
for server evaluation rules.
