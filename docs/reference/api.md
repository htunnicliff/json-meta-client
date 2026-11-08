# API

## `JsonMetaClient`

### `new JsonMetaClient(config)`

:::note TODO
- Every `Config` field with type and default; validation rules: token must be
  non-empty, username cannot contain `:`, `sessionUrl` must be parseable
:::

### `api`

### `session`

:::note TODO
- Getter returning a cached promise
:::

### `refreshSession()`

### `blob.upload()` / `blob.download()`

### `onStateChange()`

### `cancelBatch()`

### `isolated()`

:::note TODO
- Each entry: signature, return type, errors thrown, link to the feature page
:::

## Pending method calls

:::note TODO
- `resultRef`, `createdRef`, `$id`, `$args`, `$method`
:::

## `defineCapability()`

## Authentication

:::note TODO
- Add: a rejected callback prevents the request from being sent; Basic encoding handles UTF-8
:::

The `auth` option accepts a bearer token string, a username and password, or a
callback.
The client applies it to every request it sends: session discovery, method
calls, blob uploads and downloads, and event-stream connections, including
reconnects.

| `auth` value             | Sends                                                    |
| ------------------------ | -------------------------------------------------------- |
| `"<token>"`              | `Authorization: Bearer <token>`                          |
| `{ username, password }` | `Authorization: Basic` with `username:password` as UTF-8 |
| `AuthCallback`           | Whatever the callback sets on the request                |

`AuthCallback` has the type
`(args: { request: Request }) => void | Promise<void>`. It receives the
outgoing `Request` and changes it in place; the client awaits it before
running `beforeFetch` hooks. Use it for schemes the object forms don't cover,
such as a proxy header:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  capabilities: ["mail"],
  auth: ({ request }) => {
    request.headers.set("Authorization", "Bearer <token>");
    request.headers.set(
      "X-Proxy-Authorization",
      "<proxy-credential>",
    );
  },
});
```
