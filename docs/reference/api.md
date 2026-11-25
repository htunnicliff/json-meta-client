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
new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
});
```

### `auth`

For **bearer token** authentication: a `string` containing a bearer token.

```ts {3}
new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
});
```

For **basic** authentication: an object with `username` and `password`
properties.

```ts {3-6}
new JsonMetaClient({
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
new JsonMetaClient({
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
new JsonMetaClient({
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

### `generateMethodCallId` (optional)

Use a synchronous function to generate method call IDs for this client,
including calls made through `client.isolated()`. It receives the JMAP method
name, such as `Email/query`, and must return a string. IDs must be unique
within a request. A method call with an explicit `{ id }` skips the generator.

Without this option, the client uses the method name followed by `::` and
eight random hex digits.

```ts
let nextId = 0;

new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
  generateMethodCallId: () => `call-${++nextId}`,
});
```

### `transport` (optional)

A transport factory that creates the client's transport, which carries JMAP
Requests and optionally state changes. Defaults to `httpTransport()`. Use
`webSocketTransport()` for the JMAP WebSocket subprotocol. To learn more,
refer to the [transports guide](../advanced/transports.md).

```ts {7}
import { webSocketTransport } from "json-meta-client";

new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail"],
  transport: webSocketTransport({ idleSeconds: 30 }),
});
```

### `hooks` (optional)

To learn more about hook mechanics, refer to the [hooks guide](../advanced/hooks.md).

Each hook option accepts an _array_ of one or more functions that run
in sequence.

JMAP hooks receive `jmapRequest` and, for `afterJmapResponse`, `jmapResponse`.
These are JMAP envelopes. Fetch and event-source hooks receive `httpRequest`
and, for after hooks, `httpResponse`. These are Fetch `Request` and `Response`
instances.

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

A getter that returns a promise for the [`ClientSession`](./types.md#client-types).
The first read fetches the session from `sessionUrl`; later reads return the
same cached promise, so they make no request.

**Returns** a promise for the `ClientSession`. It rejects with an
[error](./errors.md) when the session can't be fetched.

```ts
const session = await client.session;

console.log(session.username, session.apiUrl);
```

The cache holds the promise, not just a successful result: when the first
fetch fails, every read of `.session`, and every method call that needs the
session, rejects with the same error until
[`refreshSession()`](#refreshsession) is called.

When a session loads for the first time, the client compares the configured
capabilities with the URNs the server advertises in `capabilities` and in each
account's `accountCapabilities`. A configured URN found in neither place is
logged with `console.warn` as a [`ConfigurationError`](./errors.md#configurationerror).
The session still resolves. Refer to
[Checking server support](../features/capabilities.md#checking-server-support).

## `.refreshSession()`

Fetches the session again and replaces the cached promise, so that later
reads of [`.session`](#session) and later batches use the new session.

**Returns** a promise for the new `ClientSession`. It rejects with an
[error](./errors.md) when the session can't be fetched.

```ts
const refreshed = await client.refreshSession();

console.log(refreshed.state);
```

Call it when the server reports a new session state, such as when a method
response's `sessionState` differs from the cached session's `state`. The
method is bound to the client, so it can be passed as a callback.

## `.blob.upload()` / `.blob.download()`

Transfer binary data through the session's `uploadUrl` and `downloadUrl`.
Unlike method calls, both require an explicit `accountId`. Refer to the
[Blobs guide](../features/blobs.md).

### `.blob.upload()`

| Parameter          | Type       | Description                       |
| ------------------ | ---------- | --------------------------------- |
| `body`             | `BodyInit` | The data to upload                |
| `params.accountId` | `string`   | The account to upload the blob to |

**Returns** a promise for the server's upload result: `accountId`, `blobId`,
`type` and `size`. It rejects with an [error](./errors.md) when the upload
fails.

The body is sent as the request body of a `POST`. A `Blob` or `File` body
sends its own `type` as the `Content-Type`.

```ts
const accountId = (await client.session).primaryAccounts[
  "urn:ietf:params:jmap:mail"
]!;

const uploaded = await client.blob.upload(
  new Blob(["Hello, world!"], { type: "text/plain" }),
  { accountId },
);

console.log(uploaded.blobId, uploaded.size);
```

### `.blob.download()`

| Parameter          | Type     | Description                                |
| ------------------ | -------- | ------------------------------------------ |
| `params.accountId` | `string` | The account that holds the blob            |
| `params.blobId`    | `string` | The blob to download                       |
| `params.type`      | `string` | The `Content-Type` to ask the server for   |
| `params.name`      | `string` | The file name to ask the server to suggest |

**Returns** a promise for the Fetch `Response`, with its body unread. It
rejects with an [error](./errors.md) when the download fails.

Each parameter fills the matching variable in the session's `downloadUrl`.

```ts
const download = await client.blob.download({
  accountId,
  blobId: uploaded.blobId,
  type: "text/plain",
  name: "hello.txt",
});

console.log(await download.text());
```

## `.onStateChange()`

Subscribes to state changes and calls a handler for each changed entity type
in each account. Changes arrive over WebSocket push when the client uses
[`webSocketTransport()`](#websockettransport) and the server supports it, and
over the server's event source otherwise. Every handler shares one
connection. Refer to the [Events guide](../features/events.md).

| Parameter             | Type                   | Description                                                        |
| --------------------- | ---------------------- | ------------------------------------------------------------------ |
| `handler`             | `OnStateChangeHandler` | Called with each change, or with an error                          |
| `options.signal`      | `AbortSignal`          | Optional. Ends this subscription when aborted                      |
| `options.pingSeconds` | `number`               | Optional. How often the event stream should ping. Defaults to `30` |

**Returns** a promise for a `Disposable`; disposing it ends the
subscription, and the connection closes when no handler is left. It rejects with an [error](./errors.md) when the subscription
can't be started.

The handler receives `(null, change)` for each change, where `change` is a
[`StateChangePayload`](./types.md#event-types), or `(error, undefined)` when
the connection fails or a message can't be read. Errors are always a
[`StateChangeError`](./errors.md#statechangeerror) and don't close the
subscription; the connection retries on its own.

```ts
using subscription = await client.onStateChange(
  (error, change) => {
    if (error) {
      console.error(error);
      return;
    }
    console.log(
      change.entity,
      change.accountId,
      change.state,
    );
  },
);
```

The client subscribes to every type, and on the event source keeps the
connection open (`closeafter=no`). On runtimes without `Symbol.dispose`, the returned object's
method is named `disconnect` instead.

## `.cancelBatch()`

Rejects every method call waiting in the client's current batch with a
[`CancellationError`](./errors.md#cancellationerror), and drops the batch so
it is never sent.

**Returns** nothing.

```ts
const cancelled = client.api.Mailbox.get({ ids: null });
client.cancelBatch();

await cancelled.catch((error: unknown) =>
  console.log(error),
);
```

A batch that has already been sent is unaffected, and so are batches made
through [`.isolated()`](#isolated), which have their own `cancel` function.
The method is bound to the client. Refer to
[Cancelling](../advanced/batching.md#cancelling).

## `.isolated()`

Runs a callback with its own `api`, whose method calls are batched apart from
`client.api` and from every other isolated `api`. Use it to keep a group of
calls in a JMAP Request of its own.

| Parameter | Type                 | Description                                                      |
| --------- | -------------------- | ---------------------------------------------------------------- |
| `fn`      | `(api, cancel) => R` | Called at once with the isolated `api` and its `cancel` function |

**Returns** whatever `fn` returns, unchanged, so an async callback's promise
is returned as is. An error thrown by `fn` propagates.

```ts
const isolatedMailboxes = client.isolated((api) =>
  api.Mailbox.get({ ids: null }),
);

void client.api.Identity.get({ ids: null });

console.log((await isolatedMailboxes).list.length);
```

Here the two calls are sent in separate JMAP Requests. `cancel` works like
[`.cancelBatch()`](#cancelbatch) for the isolated batch only. Result
references can only point to calls in the same batch, so a call made on an
isolated `api` cannot reference one made on `client.api`. Refer to
[Isolated queues](../advanced/batching.md#isolated-queues).

## `[Symbol.dispose]()`

Release the client's connections. JMAP Requests, blob transfers and session
requests in flight reject with `CancellationError`, every `onStateChange`
subscription ends, and the transport is disposed. Later method calls, blob
transfers, session refreshes and subscriptions reject with
`CancellationError`. On a runtime without `Symbol.dispose`, this method is
named `disconnect`.

## `httpTransport()`

The default transport factory: sends each JMAP Request as an HTTP `POST` to
the session's `apiUrl`.

## `webSocketTransport()`

A transport factory for the JMAP WebSocket subprotocol (RFC 8887).

<<< ../../src/transports/websocket/types.ts#websocket-transport-options

<<< ../../src/transports/websocket/types.ts#websocket-like

## Pending method calls

Each method on `client.api`, such as `client.api.Email.get(args)`, returns a
pending method call: a promise for the method's response arguments, with
extra members for referencing the call before it settles.

| Parameter    | Type     | Description                                                                                            |
| ------------ | -------- | ------------------------------------------------------------------------------------------------------ |
| `args`       | `object` | The method's arguments, typed from its capability                                                      |
| `options.id` | `string` | Optional. The method call ID, used instead of [`generateMethodCallId`](#generatemethodcallid-optional) |

**Returns** a pending method call. It resolves with the method's response
arguments, and rejects with a [`JmapError`](./errors.md#jmaperror) when the
server returns an error for the call, or with another [error](./errors.md)
when the call or its batch fails.

| Member               | Type           | Description                                                                                                                       |
| -------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `resultRef(pointer)` | `Ref`          | A result reference to a path in this call's response                                                                              |
| `createdRef(id)`     | `` `#${id}` `` | `/set` calls only. A reference to an object this call creates                                                                     |
| `$id`                | `string`       | The method call ID                                                                                                                |
| `$args`              | `object`       | The arguments as sent: result reference names carry their `#` prefix, and the default `accountId` is added when the batch is sent |
| `$method`            | `string`       | The JMAP method name, such as `Email/get`                                                                                         |

### `resultRef()`

Creates an RFC 8620 result reference to the JSON Pointer `pointer` in this
call's response. Pass it as a whole, top-level argument of a later call in the
same batch; the client sends that argument with a `#` prefix, and the server
substitutes the value. Pointers are type-checked against the response, and
`*` maps over every element of an array.

```ts
const mailboxQuery = client.api.Mailbox.query({
  filter: { role: "inbox" },
});

const mailboxes = await client.api.Mailbox.get({
  ids: mailboxQuery.resultRef("/ids"),
});

console.log(mailboxes.list[0]!.name);
```

A call whose references break the RFC's rules rejects with a
[`ResultReferenceError`](./errors.md#resultreferenceerror) without being sent.
Refer to [Result references](../features/method-calls.md#result-references).

### `createdRef()`

Returns `` `#${id}` ``, the reference RFC 8620 uses for an object created by a
`/set` call, where `id` is a key of the call's `create` argument. Use it
wherever a later call in the same batch takes that object's ID.

```ts
const createMailbox = client.api.Mailbox.set({
  create: { archive: { name: "Archive" } },
});

void client.api.Email.query({
  filter: {
    inMailbox: createMailbox.createdRef("archive"),
  },
});
```

It throws a `RangeError` synchronously when `create` has no such key. Refer to
[Creation references](../features/method-calls.md#creation-references).

### `$id`, `$args` and `$method`

Read-only details of the call, available as soon as it is made. `$id` matches
the third element of the call's invocation in the JMAP Request, which is
useful for matching requests in tests and hooks. Refer to
[Call metadata](../features/method-calls.md#call-metadata).

```ts
const identities = client.api.Identity.get({ ids: null });

console.log(identities.$method, identities.$id);
```

## `defineCapability()`

Defines a capability for entities and methods the library doesn't build in.
Pass the result in [`capabilities`](#capabilities). Refer to the
[Extending guide](../advanced/extending.md).

**Returns** an object with a `withMethods()` method, which returns the
[`Capability`](./types.md#capability-types). `withMethods()` takes no
arguments, only type arguments: the method contracts, then optionally the
account and session details.

| Option           | Type                               | Description                                                                           |
| ---------------- | ---------------------------------- | ------------------------------------------------------------------------------------- |
| `urn`            | `string`                           | The capability's URN, sent in `using`                                                 |
| `entities`       | `string[]`                         | The entities whose methods the capability declares                                    |
| `dependsOn`      | `string[]` (optional)              | Other URNs to send in `using` with the capability's calls                             |
| `defaultAccount` | `DefaultAccountSetting` (optional) | Which methods get a default `accountId`. Omitted, all of them use the primary account |

```ts
import { defineCapability } from "json-meta-client";

const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note"],
}).withMethods<{
  Note: {
    get: {
      input: { accountId: string; ids: string[] | null };
      output: { list: { id: string; text: string }[] };
    };
  };
}>();

const notesClient = new JsonMetaClient({
  sessionUrl: "https://<something>/.well-known/jmap",
  auth: "<token>",
  capabilities: ["mail", notes],
});

const notesResult = await notesClient.api.Note.get({
  ids: null,
});
```

The client validates every capability when it is constructed, and throws a
[`CapabilityConfigurationError`](./errors.md#capabilityconfigurationerror)
for a malformed one, or when two capabilities claim the same method with
different `defaultAccount` settings.

## Authentication

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
such as a proxy header, or to read a fresh credential for every request:

```ts
import { JsonMetaClient } from "json-meta-client";

new JsonMetaClient({
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

If the callback throws or rejects, the request is not sent and its call
rejects with a [`NetworkError`](./errors.md#networkerror) whose `cause` is the
callback's error.

The constructor validates `auth` and throws a
[`ConfigurationError`](./errors.md#configurationerror) for an empty or
whitespace token, an empty username, or a username containing `:`, which
Basic authentication can't encode. Basic credentials are encoded as UTF-8, so
non-ASCII usernames and passwords are sent intact.
