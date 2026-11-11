---
outline: [2, 3]
---

# API

## `new JsonMetaClient()`

<!--@include: ../snippets/full-client.md -->

- Parameters: [`Config`](#config)
- Returns: `JsonMetaClient`

## `Config`

### `sessionUrl`

A `string` or `URL` instance for a JMAP server session endpoint.

```ts {2}
const client = new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
});
```

### `auth`

For **bearer token** authentication: a `string` containing a bearer token.

```ts {3}
const bearerClient = new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
});
```

For **basic** authentication: an object with `username` and `password`
properties.

```ts {3-6}
const basicClient = new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: {
    username: "<username>",
    password: "<password>",
  },
  capabilities: ["mail"],
});
```

For other authentication strategies: a function that modifies each
outgoing request.

```ts {3-5}
const customAuthClient = new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: async ({ request }) => {
    request.headers.set("X-Custom", "<custom-value>");
  },
  capabilities: ["mail"],
});
```

### `capabilities`

An array of the JMAP capabilities this client will use.

Each capability is associated with specific entities and methods. Including a
capability in this array will make its corresponding entities and methods
available at runtime while also enabling their types.

```ts {4-9}
const mailClient = new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: [
    "mail",
    "submission",
    "vacationResponse",
    "sieve",
  ],
});
```

To see which capabilities are supported out of the box, refer to the
[list of built-in capabilities](./capabilities.md#built-in).

### `hooks` (optional)

To learn more about hook mechanics, refer to the [hooks guide](../advanced/hooks.md).

Each hook option accepts an _array_ of one or more functions that run
in sequence.

#### `hooks.beforeFetch`

Runs for every fetch request (e.g. session, JMAP, blob).

Use this hook to modify a fetch [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
before it is sent.

<<< ../../src/types.ts#hook-before-fetch

#### `hooks.afterFetch`

Runs for every fetch request (e.g. session, JMAP, blob).

Use this hook to modify a fetch [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
after it is received.

<<< ../../src/types.ts#hook-after-fetch

#### `hooks.beforeJmapRequest`

Use this hook to modify a [`JmapRequest`](./types.md#jmaprequest) object.

<<< ../../src/types.ts#hook-before-jmap-request

#### `hooks.afterJmapResponse`

Use this hook to modify a [`JmapResponse`](./types.md#jmapresponse) object.

<<< ../../src/types.ts#hook-after-jmap-response

#### `hooks.beforeEventSourceConnect`

Use this hook to modify the fetch [`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
used to connect an event source before it is sent. It has the same signature
as [`hooks.beforeFetch`](#hooks-beforefetch).

<<< ../../src/types.ts#hook-before-event-source-connect

#### `hooks.afterEventSourceConnect`

Use this hook to observe the fetch [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
received when an event source connects, such as to read its headers. The
hook cannot replace the response, and it should leave the body unread so
the client can stream events from it.

<<< ../../src/types.ts#hook-after-event-source-connect

## `.api`

This is the primary API for issuing JMAP requests. These requests use the
following pattern:

```
<Entity>.<method>
```

Here are several examples of JMAP requests made using this API.

| JMAP                    | Usage                                    |
| ----------------------- | ---------------------------------------- |
| `Email/query`           | `client.api.Email.query(args)`           |
| `Mailbox/get`           | `client.api.Mailbox.get(args)`           |
| `Identity/queryChanges` | `client.api.Identity.queryChanges(args)` |

The JMAP standard refers to these requests as method calls.

The `.api` object is a layered [`Proxy`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Proxy)
that helps to capture the entity, method, and arguments used in each request.

A more thorough explanation can be found in the
[Method Calls guide](../features/method-calls.md).

## `.session`

:::warning TODO
- Getter returning a cached promise
:::

## `.refreshSession()`

## `.blob.upload()` / `blob.download()`

## `.onStateChange()`

## `.cancelBatch()`

## `.isolated()`

:::warning TODO
- Each entry: signature, return type, errors thrown, link to the feature page
:::

## Pending method calls

:::warning TODO
- `resultRef`, `createdRef`, `$id`, `$args`, `$method`
:::

## `defineCapability()`

## Authentication

:::warning TODO
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

const proxiedClient = new JsonMetaClient({
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
