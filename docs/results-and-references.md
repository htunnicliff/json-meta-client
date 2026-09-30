# Results and result references

An API method returns a promise carrying the pending call's
`id`, `method`, and `args`. Awaiting it returns the method's data,
not the whole JMAP response envelope. Result IDs match responses
to promises, so response order does not determine which call
receives a value.

`ref(pendingCall, pointer)` constructs a JMAP result reference.
Queue the source before its dependent calls within one batching
window. Unlike awaiting the source and passing its values, a
reference lets the server resolve the dependency in the same
request:

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

The client transforms `ids: ref(query, "/ids")` into the protocol
argument `"#ids": { name: "Email/query", resultOf: query.id,
path: "/ids" }`. Built-in middleware performs this transformation
at argument positions, including nested objects. References can be
reused by several calls. The source's arguments and results are
not fetched locally when constructing a reference.

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
case. Unknown response types produce unknown reference values;
permissive `any` contracts provide less protection.

For typed results, `ref()` restricts paths to known properties and
carries the selected value's type into the receiving argument.
Requesting selected properties with `get` also restricts the paths
to that selection. The public `Ref`, `AllowRefs`, and `UnpackRefs`
types support capability contracts. Construct references with
`ref()` rather than assembling plain JSON objects; the client
recognizes references created by its helper.

References are request-local. The client does not make a previously
sent source available in a later request. Await the source and pass
its data when a batching boundary intervenes. See
[batching](batching.md) for boundaries and request limits, and
[RFC 8620 section 3.7](https://www.rfc-editor.org/rfc/rfc8620.html#section-3.7)
for server evaluation rules.
