# Result References

A result reference tells the JMAP server to use data from an earlier method result as an argument to another call in the same request.

## Query Then Get

```ts
const query = client.api.Email.query({ limit: 10 });
const get = client.api.Email.get({
  ids: query.ref("/ids"),
  properties: ["subject"],
});

const [, emails] = await Promise.all([query, get]);
```

Call `.ref()` on the pending method promise. Do not await the query before creating the get call: awaiting it would let the first batch complete.

## Pointer Paths

The pointer selects a value from the response arguments:

| Pointer      | Selected value                    |
| ------------ | --------------------------------- |
| `/ids`       | The query’s ID array              |
| `/list/0/id` | The first record’s ID             |
| `/list/*/id` | An array of IDs from every record |

TypeScript infers the selected value’s type from the method’s response. The server evaluates the pointer at runtime, so the selected data must actually exist.

## Wire Format

The client rewrites a referenced argument into JMAP’s `#` form. For the query/get example, the get arguments include:

```json
{
  "#ids": {
    "name": "Email/query",
    "resultOf": "<query-call-id>",
    "path": "/ids"
  }
}
```

`name` identifies the source method, `resultOf` identifies the call, and `path` selects its response data. The client also rewrites reference keys within nested argument objects. Whether a reference at a particular location is accepted depends on the server and method; the standard query/get pattern uses a top-level argument.

## Constraints and Failures

Create the source call first, then the dependent call, on the same client and within the same batch. A reference cannot point into a previous HTTP request. After awaiting a result, pass its ordinary values instead.

A failed source call or invalid pointer can cause the dependent call to reject with a JMAP error. See [Batching](./batching.md) and [Errors](../reference/errors.md).
