# json-meta-client

## 1.0.1

### Patch Changes

- [#328](https://github.com/htunnicliff/json-meta-client/pull/328) [`032bd67`](https://github.com/htunnicliff/json-meta-client/commit/032bd67c6c15671a96d1256460cf9935f92871cb) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Refresh the README badges shown on npm: all badges now come from shields.io, and the README adds CI status, zero-dependency, and gzip bundle size badges.

## 1.0.0

### Major Changes

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - json-meta-client 1.0.0 is the first stable release. From this version on,
  it follows semantic versioning, and the
  [versioning policy](https://json-meta-client.dev/reference/versioning)
  describes how changes to its types map to version numbers.

  The entries below describe what changed since 0.14.0. The 1.0.0-alpha
  sections further down list each change as it was made.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** the required `auth` option replaces `bearerToken`. There is no
  alias for the old option.

  ```ts
  // 0.14
  new JsonMetaClient({
    bearerToken: token,
    sessionUrl,
    capabilities,
  });

  // 1.0
  new JsonMetaClient({
    auth: token,
    sessionUrl,
    capabilities,
  });
  ```

  `auth` also accepts Basic credentials, which the client encodes, or a
  callback that changes each outgoing request:

  ```ts
  // Basic credentials
  auth: { username, password },

  // A callback
  auth: async ({ request }) => {
    request.headers.set("Authorization", `Bearer ${await getToken()}`);
  },
  ```

  Authentication applies to every request the client makes: session
  discovery, method calls, blob transfers, and each event stream connection
  and reconnect. The callback runs for each one, so it can supply fresh
  credentials.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** new hooks replace `beforeRequest`, `afterResponse`, and the
  unstable `middleware` option.

  | 0.14                       | 1.0                       |
  | -------------------------- | ------------------------- |
  | `hooks.beforeRequest`      | `hooks.beforeFetch`       |
  | `hooks.afterResponse`      | `hooks.afterFetch`        |
  | `middleware`               | `hooks.beforeJmapRequest` |
  | `BeforeRequestHook` (type) | `BeforeFetchHook`         |
  | `AfterResponseHook` (type) | `AfterFetchHook`          |

  Fetch hooks receive `httpRequest` and, after the fetch, `httpResponse`,
  instead of `request` and `response`:

  ```ts
  hooks: {
    beforeFetch: [({ httpRequest }) => httpRequest],
    afterFetch: [({ httpResponse }) => httpResponse],
  },
  ```

  The new hooks are:

  - `beforeJmapRequest` and `afterJmapResponse`, which receive the whole JMAP
    Request (`jmapRequest`) and Response (`jmapResponse`) of each batch. Use
    `beforeJmapRequest` in place of `middleware` to change outgoing method
    calls.
  - `beforeEventSourceConnect` and `afterEventSourceConnect`, which run for
    each event stream connection and reconnect.

  Each option takes an array of hooks, which may be async and run in order.
  Passing `middleware` is now a type error, and the client ignores it.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** the default `accountId` now depends on the method. In 0.14,
  every call without an `accountId` used the primary mail account. Now the
  client picks the account when it sends the batch:

  1. The primary account of the capability that owns the method, from
     `session.primaryAccounts`. A `ContactCard/get` call, for example, goes to
     the primary contacts account.
  2. Otherwise, the only account whose `accountCapabilities` list that
     capability.
  3. Otherwise, if no account lists it, the call is sent without `accountId`.

  If several accounts list the capability and none is primary, the call
  rejects with a `ConfigurationError`. The rest of the batch is still sent.
  Pass `accountId` to choose an account.

  Other changes:

  - `Core/echo` and `PushSubscription` calls are not scoped to an account and
    no longer get an `accountId`.
  - `$args.accountId` is absent until the batch is sent. `beforeJmapRequest`
    hooks see it on each call's arguments.
  - One batch can now go to several accounts. A result reference between
    calls to different accounts may need an explicit `accountId`.

  Custom capabilities can choose which methods get a default with the new
  `defaultAccount` setting. A method set to `null` gets no default, and its
  `accountId` is required:

  ```ts
  const tasks = defineCapability({
    urn: "urn:example:tasks",
    entities: ["Task"],
    defaultAccount: { "*": "primary", "Task/copy": null },
  });
  ```

  The client constructor throws `CapabilityConfigurationError` when two
  capabilities claim the same method with different settings.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** `client.blob.upload()`, `client.blob.download()`, and
  `Blob/copy` now require `accountId`. In 0.14, the blob transfers defaulted to
  the primary mail account, but the right account depends on what the blob is
  for.

  ```ts
  await client.blob.upload(body, { accountId });
  await client.blob.download({
    accountId,
    blobId,
    type,
    name,
  });
  await client.api.Blob.copy({
    fromAccountId,
    accountId,
    blobIds,
  });
  ```

  For `Blob/copy`, `accountId` is the destination account. `Email/copy`,
  `ContactCard/copy`, and the RFC 9404 `Blob/upload`, `Blob/get`, and
  `Blob/lookup` methods still default it.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** `isPrimaryAccount` on a state change is now decided by the
  changed entity. In 0.14, it was true only for the primary mail account.

  It is now true when an `Entity/get` call for that entity, without an
  `accountId`, would go to the changed account. With a primary mail account A
  and a primary contacts account B:

  | State change       | 0.14    | 1.0     |
  | ------------------ | ------- | ------- |
  | `Email` in A       | `true`  | `true`  |
  | `ContactCard` in B | `false` | `true`  |
  | `Email` in B       | `false` | `false` |
  | `ContactCard` in A | `true`  | `false` |

  For an entity with no such call, such as `EmailDelivery`, it is true when
  the account is the primary account of any configured capability, or the
  session's only account. `onStateChange` no longer needs a primary mail
  account.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** a method call on an entity that no configured capability
  declares, such as `client.api.Foo.bar()`, now rejects with
  `UnknownEntityError` and is never sent. In 0.14, it was sent without a
  capability URN in `using`.

  Add a built-in capability that declares the entity, or declare it with
  `defineCapability`. `Core`, `Blob`, and `PushSubscription` stay callable
  without listing `core`.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** method types are stricter.

  - Arguments reject properties the method doesn't declare, at any depth:
    at the top level, in `/set` `create` and `update` entries, and in filter
    conditions inside `AND`, `OR`, and `NOT`. In 0.14, TypeScript let a
    misspelled property, a server-set property, or a filter condition from a
    capability the client doesn't configure through. Methods that leave their
    arguments open, such as `Core/echo`, are not checked.
  - `Blob`, `ContactCard`, `AddressBook`, and `SieveScript` methods now check
    their arguments and type their responses.
  - The types now follow the RFCs more closely. For example, the session's
    core limits are required, email address names can be `null`, and creating
    an `Email` requires `mailboxIds`.

  The types are now part of the package instead of the `jmap-rfc-types`
  dependency. To import them, use the new `json-meta-client/rfc-types` entry
  point.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** result references now follow RFC 8620 §3.7. A `resultRef()`
  must be a whole, top-level argument. The types reject one nested in an
  object, such as a `filter` condition, or in an array.

  The client also rejects a method call with the new `ResultReferenceError`,
  without sending it, when:

  - a reference is nested,
  - the arguments name both `foo` and `#foo`,
  - a reference points to a call from an earlier batch, or
  - another call in the same batch already uses its method call ID.

  The rest of the batch is still sent.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** creation references now follow RFC 8620 §5.3, and their
  errors are the new `CreationReferenceError` instead of `RangeError`. Its
  `reason` says what went wrong:

  - `"unknown-id"`: `createdRef()` was given an ID that isn't a key of
    `create`.
  - `"batch-sent"`: `createdRef()` was called after its `/set` call's batch
    was sent, for example after `await`ing the call. The server would no
    longer resolve the reference.
  - `"duplicate-id"`: a `/set` or `/copy` call, or `Email/import`, reuses a
    creation ID from an earlier call in the same batch. The call rejects
    without being sent, and the rest of the batch is still sent.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** S/MIME types now need the new `smime` capability. With only
  `"mail"`, `Email/get` no longer accepts the `smime*` properties, and
  `Email/query`, `Email/queryChanges`, and `SearchSnippet/get` no longer
  accept the `hasSmime` and `hasVerifiedSmime` filter conditions.

  ```ts
  capabilities: ["mail", "smime"],
  ```

  With `smime`, `Email` and `SearchSnippet` calls also send
  `urn:ietf:params:jmap:smimeverify`. Configuring `smime` without `mail`
  throws `CapabilityConfigurationError`.

### Minor Changes

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add the `transport` client option and `webSocketTransport()`, for the JMAP
  WebSocket subprotocol (RFC 8887). The default, `httpTransport()`, behaves as
  0.14 did.

  ```ts
  import {
    JsonMetaClient,
    webSocketTransport,
  } from "json-meta-client";

  const client = new JsonMetaClient({
    sessionUrl,
    auth: token,
    capabilities: ["mail"],
    transport: webSocketTransport(),
  });
  ```

  All of a client's batches share one socket. It opens with the first batch
  and closes after `idleSeconds` (default 60) with nothing pending. A request
  with no response within `requestTimeoutSeconds` (default 60) closes the
  socket and rejects what was waiting with `NetworkError`. While push is
  enabled, a `Core/echo` heartbeat every `heartbeatSeconds` (default 30)
  detects a dead socket and reconnects. The global `WebSocket` can't send
  the headers from `auth`, so pass `createWebSocket` to use a client that can,
  such as the `ws` package.

  To write your own transport, implement the new `Transport` interface. The
  package now exports the `JmapRequest`, `JmapResponse`, `Session`, and
  `StateChange` types it needs.

  The client now wraps a transport error that isn't a `JsonMetaError` in a
  `NetworkError`, or a `CancellationError` once the client is disposed, with
  the original error as its `cause`. A response body that isn't valid JSON
  rejects with `NetworkError` instead of `SyntaxError`.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - `onStateChange` handlers now share one push channel, and the client reads
  the event stream itself instead of using `eventsource-client`.

  - With `webSocketTransport()` and a server that supports push, state changes
    arrive over the WebSocket, and the transport resumes from the last
    `pushState` after reconnecting.
  - Otherwise, the client opens one event stream for each distinct
    `pingSeconds` value, instead of one for each handler.
  - The event stream reconnects when it ends or the network fails, sending
    `Last-Event-ID` and honoring the server's `retry` time. After repeated
    failures, it backs off with jitter, up to a minute.
  - If nothing arrives, not even a ping, for two ping intervals, the client
    reconnects and reports a `StateChangeError` to the handler.
  - If the server refuses the connection with an HTTP error, or responds with
    something other than an event stream, the client reports a
    `StateChangeError` and stops reconnecting. HTTP 204 also stops it, without
    an error.
  - A handler receives nothing before its `onStateChange` call resolves, and a
    `signal` that aborts while the subscription starts ends it.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add `client[Symbol.dispose]()`, so a client can be declared with `using`:

  ```ts
  using client = new JsonMetaClient({
    sessionUrl,
    auth,
    capabilities,
  });
  ```

  Disposing a client rejects requests in flight with `CancellationError`,
  ends every `onStateChange` subscription, and disposes the transport. Later
  calls reject with `CancellationError`. On a runtime without
  `Symbol.dispose`, the method is named `disconnect`, as the new
  `DisposeFallback` type describes.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add built-in capabilities for more JMAP extensions:

  - `quota` (RFC 9425): `Quota` methods.
  - `sharing` (RFC 9670): `Principal` and `ShareNotification` methods.
  - `mdn` (RFC 9007): `MDN/send` and `MDN/parse`.
  - `smime` (RFC 9219): the S/MIME properties and filters on `Email`. Use it
    with `mail`.

  A capability can list other URNs its methods need with the new `dependsOn`
  option, including in `defineCapability()`. The client adds them to `using`
  whenever one of the capability's entities is called.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add the `json-meta-client/rfc-types` entry point. It exports the JMAP types
  that the built-in capabilities are made from, such as `MethodGet`,
  `MethodSet`, and `MethodQuery`, and the core, mail, contacts, and sharing
  entity types. Use them to build method contracts for custom capabilities:

  ```ts
  import type { MethodGet } from "json-meta-client/rfc-types";

  type BookmarkGet = MethodGet.Contract<Bookmark>;
  ```

  The JSContact (RFC 9553) types are under the `JSContact` namespace, because
  some of their names, such as `EmailAddress`, are also JMAP type names. The
  entry point exports only types.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - `header:` properties on `Email` and its body parts are now typed by their
  parsed form (RFC 8621 §4.1.2) instead of `unknown`:

  | Property                    | Type                     |
  | --------------------------- | ------------------------ |
  | `header:To:asAddresses`     | `EmailAddress[] \| null` |
  | `header:Subject:asText:all` | `string[]`               |
  | `header:X-Spam`             | `string \| null`         |

  Creating an `Email` checks each header value against its form. The
  `EmailHeaderForms` and `EmailHeaderValue` types are exported from
  `json-meta-client/rfc-types`.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add `patch()` and `patchMap()` for partial updates in a `/set` call's
  `update`. A plain object is still the property's whole new value, as in
  JMAP.

  `patch()` changes only the keys it's given:

  ```ts
  await client.api.Email.set({
    update: {
      [emailId]: {
        keywords: patch({ $seen: true }),
      },
    },
  });
  ```

  `patchMap()` builds the paths for a map keyed by ID, such as `mailboxIds`.
  A computed key built from a variable ID is typed as `string`, so the
  compiler can't check it. `patchMap()` checks the map's name and values:

  ```ts
  await client.api.Email.set({
    update: {
      [emailId]: patchMap("mailboxIds", {
        [inboxId]: null,
        [archiveId]: true,
      }),
    },
  });
  ```

  Both send each key as a JSON Pointer path, escaping `~` and `/`.
  `onSuccessUpdateEmail` accepts them too. The `update` types are now
  `UpdatePatch<T>`, exported from `json-meta-client/rfc-types` with `Patch<T>`
  and `PatchValue<T>`.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Method arguments are now optional when a method has no required arguments
  once the client fills in `accountId`. `client.api.Mailbox.get()` is the same
  as `client.api.Mailbox.get({})`. To pass options without arguments, give
  `undefined` as the arguments.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add two client options:

  - `generateMethodCallId` returns the ID for each method call, given its
    method name. It applies to isolated batches too. An explicit `id` on a
    call takes precedence.
  - `onWarning` receives the configured capabilities that the server doesn't
    advertise, as a `ConfigurationError`, when the session first loads. It
    defaults to `console.warn`, as in 0.14.

  The client no longer warns about a capability that the server lists only in
  an account's `accountCapabilities`, as Stalwart does for
  `urn:stalwart:jmap`.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - `JsonMetaClient`'s second type parameter now has a default, so a client
  type can be named by its capabilities alone, for example in a function
  parameter:

  ```ts
  function summarize(client: JsonMetaClient<["mail"]>) {}
  ```

### Patch Changes

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Declare the supported runtimes: Node.js 22 or later and TypeScript 5.4 or
  later. The published JavaScript now targets ES2023 instead of `esnext`.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - The package no longer has runtime dependencies. The types that came from
  `jmap-rfc-types` and `type-fest` are now part of the library, and the client
  reads the event stream without `eventsource-client`.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - The published JavaScript is no longer minified and no longer ships source
  maps. Stack traces and debugger steps inside the library show the original
  names. JSDoc comments are left out of the JavaScript, and the type
  declarations keep them.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - `resultRef()` now flattens arrays collected by a `*` wildcard, as RFC 8620
  §3.7 specifies. On a `Thread/get` call, `resultRef("/list/*/emailIds")` is
  typed `Ref<string[]>` instead of `Ref<string[][]>`, so it can be passed as
  `ids` to `Email/get`.

- [#322](https://github.com/htunnicliff/json-meta-client/pull/322) [`bad28f0`](https://github.com/htunnicliff/json-meta-client/commit/bad28f0d8f6c0d2b796c6bbf419397c7ba663a2a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Fix `cancelBatch()`, and the `cancel` that `isolated()` passes to its
  callback, working only the first time. Every call now rejects the method
  calls waiting in the current batch with `CancellationError`.

## 1.0.0-alpha.3

### Major Changes

- [#198](https://github.com/htunnicliff/json-meta-client/pull/198) [`01d1b6d`](https://github.com/htunnicliff/json-meta-client/commit/01d1b6dd6ca82b8871f23058e8c1d0844d895054) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** the default `accountId` now comes from the primary account of
  the capability that owns the method, `session.primaryAccounts[urn]`, instead
  of always the primary mail account. A `ContactCard/get` call, for example,
  now uses the primary contacts account. Servers must list each capability's
  URN in `primaryAccounts`; when one is missing, the client sends that
  capability's calls without `accountId`, so pass it explicitly. `Core/echo`
  and `PushSubscription` calls are not scoped to an account and no longer get
  an `accountId` added.

  Custom capabilities can choose which methods get a default with the new
  `defaultAccount` setting:

  ```ts
  const tasks = defineCapability({
    urn: "urn:example:tasks",
    entities: ["Task"],
    defaultAccount: { "*": "primary", "Task/copy": null },
  });
  ```

  A method set to `null` gets no default, and its `accountId` becomes required
  at the type level. Leaving the setting out is the same as
  `{ "*": "primary" }`. When two capabilities claim the same method with
  different settings, such as two capabilities with different URNs that both
  declare an entity without a `defaultAccount`, the client constructor throws
  `CapabilityConfigurationError`.

- [#223](https://github.com/htunnicliff/json-meta-client/pull/223) [`3cf4d0f`](https://github.com/htunnicliff/json-meta-client/commit/3cf4d0f8260a2c6f38ef36ca99f8c76fd94c09cd) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** the default `accountId` is now chosen when a batch is sent,
  and no longer only from `session.primaryAccounts`.

  When a method call doesn't pass `accountId` and the session names no primary
  account for the capability that owns the method, the client now looks at the
  accounts whose `accountCapabilities` list that capability's URN:

  - **One account:** the client uses it. These calls used to be sent without
    `accountId`.
  - **No account:** the call is sent without `accountId`, as before.
  - **Several accounts:** the call rejects with a `ConfigurationError` that
    names the method and the URN. Only that call is rejected: it is left out of
    the request, and the other calls in the batch still go ahead. If every call
    in a batch is rejected, no request is made. Pass `accountId` to choose an
    account.

  The `accountId` is written onto the call's arguments once the session has
  loaded, right before the `beforeJmapRequest` hooks run:

  - `$args.accountId` is absent until the batch is sent and set afterwards.
    Reading it before the session loaded used to throw "Session not yet
    resolved".
  - `beforeJmapRequest` hooks receive `accountId` as a plain value on the
    arguments. It used to be a getter.

  A result reference passed as `accountId` is now kept. The client used to add
  a default `accountId` beside it.

  Method calls in one batch can go to different accounts, such as the primary
  mail and primary contacts accounts. A result reference between two such
  calls may need an explicit `accountId`.

- [#223](https://github.com/htunnicliff/json-meta-client/pull/223) [`3cf4d0f`](https://github.com/htunnicliff/json-meta-client/commit/3cf4d0f8260a2c6f38ef36ca99f8c76fd94c09cd) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** `isPrimaryAccount` on state changes is now decided per entity.
  It used to be true only for the primary mail account, whatever had changed.

  It is now true when an `Entity/get` call for the changed entity that passes
  no `accountId` would go to that account, by the same rules as method calls.
  With a primary mail account A and a primary contacts account B:

  | State change       | Before  | Now     |
  | ------------------ | ------- | ------- |
  | `Email` in A       | `true`  | `true`  |
  | `ContactCard` in B | `false` | `true`  |
  | `Email` in B       | `false` | `false` |
  | `ContactCard` in A | `true`  | `false` |

  Some types have no such call to resolve, such as the push-only
  `EmailDelivery`, or an entity whose `/get` method has no default account.
  For those, `isPrimaryAccount` is true when the account is the primary
  account of any configured capability, or is the session's only account.

  `isPrimaryAccount` is `false` when several accounts could serve the entity
  and the session names no primary account for it.

  `onStateChange` no longer needs a primary mail account, so it reports
  `isPrimaryAccount` correctly on a session with no mail capability.

- [#249](https://github.com/htunnicliff/json-meta-client/pull/249) [`ca7f446`](https://github.com/htunnicliff/json-meta-client/commit/ca7f446e0554a38ba5ca8ebcdcf37a12384e287b) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Breaking change to hook callback arguments. JMAP hooks receive `jmapRequest`
  and, in `afterJmapResponse`, `jmapResponse`. Fetch and event-source hooks
  receive `httpRequest` and, in after hooks, `httpResponse`.

- [#198](https://github.com/htunnicliff/json-meta-client/pull/198) [`01d1b6d`](https://github.com/htunnicliff/json-meta-client/commit/01d1b6dd6ca82b8871f23058e8c1d0844d895054) Thanks [@htunnicliff](https://github.com/htunnicliff)! - BREAKING: `client.blob.upload()`, `client.blob.download()`, and `Blob.copy`
  now require `accountId`. The client no longer fills it in from the primary
  mail account, because the right account depends on what the blob is for. On
  a server with no primary mail account, the old default was missing at
  runtime even though the types let callers omit it.

  Pass the account explicitly:

  ```ts
  await client.blob.upload(body, { accountId });
  await client.blob.download({
    accountId,
    blobId,
    type,
    name,
  });
  await client.api.Blob.copy({
    fromAccountId,
    accountId,
    blobIds,
  });
  ```

  For `Blob.copy`, `accountId` is the destination account. `Email.copy` and
  `ContactCard.copy` still default it, and so do the RFC 9404 `Blob.upload`,
  `Blob.get`, and `Blob.lookup` methods.

- [#257](https://github.com/htunnicliff/json-meta-client/pull/257) [`2333e72`](https://github.com/htunnicliff/json-meta-client/commit/2333e7283a4e64f17f85962a0d203789ccc14ed7) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** result references now follow RFC 8620 §3.7. A `resultRef()`
  is accepted only as a whole, top-level argument; the types reject one nested
  in an object value (such as a `filter` condition) or an array item. The
  client now rejects a method call with the new `ResultReferenceError` before
  sending it when a reference is nested, when the arguments name both `foo`
  and `#foo`, when a reference names a call from an earlier batch, or when
  another call in the same batch already uses its method call ID. The rest of
  the batch is still sent.

### Minor Changes

- [#275](https://github.com/htunnicliff/json-meta-client/pull/275) [`2d37ca2`](https://github.com/htunnicliff/json-meta-client/commit/2d37ca2c8603fada58887cbd5a6a871eaf994b82) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add `client[Symbol.dispose]()`, so a client can be declared with `using`.
  Disposing a client rejects JMAP Requests, blob transfers and session requests
  in flight with `CancellationError`, ends every `onStateChange` subscription,
  and disposes the transport. Later method calls, blob transfers, session
  refreshes and subscriptions reject with `CancellationError`. On a runtime
  without `Symbol.dispose`, the method is named `disconnect`.

- [#275](https://github.com/htunnicliff/json-meta-client/pull/275) [`2d37ca2`](https://github.com/htunnicliff/json-meta-client/commit/2d37ca2c8603fada58887cbd5a6a871eaf994b82) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Type the `disconnect` fallback used on runtimes without `Symbol.dispose`. The
  client, the `Transport` interface and the subscriptions `onStateChange()`
  resolves to now declare an optional `disconnect()` method, described by the
  new `DisposeFallback` type. A transport's `subscribe` may return the new
  `DisposableLike`: a `Disposable`, or an object with a `disconnect` method.

- [#276](https://github.com/htunnicliff/json-meta-client/pull/276) [`89316b9`](https://github.com/htunnicliff/json-meta-client/commit/89316b95b0280d18978a196bdb85b894bb27681c) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add a `json-meta-client/rfc-types` entry point that exports the JMAP types the
  built-in capabilities are made from, such as `MethodGet`, `MethodSet`,
  `MethodQuery`, and the core, mail, contacts, and sharing entity types. Use
  them to build method contracts for custom capabilities, for example
  `MethodGet.Contract<Bookmark>`. The JSContact (RFC 9553) types are exported
  under the `JSContact` namespace, since some of their names, such as
  `EmailAddress`, are also JMAP type names. The entry point exports types only.

- [#247](https://github.com/htunnicliff/json-meta-client/pull/247) [`afa867d`](https://github.com/htunnicliff/json-meta-client/commit/afa867df58bcd83024de4759c32458f85c8bf972) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Set `generateMethodCallId` on a client to generate custom method call IDs.
  The callback receives the JMAP method name and returns a string synchronously.
  This also applies to isolated batches. An explicit `{ id }` on a method call
  takes precedence.

- [#275](https://github.com/htunnicliff/json-meta-client/pull/275) [`2d37ca2`](https://github.com/htunnicliff/json-meta-client/commit/2d37ca2c8603fada58887cbd5a6a871eaf994b82) Thanks [@htunnicliff](https://github.com/htunnicliff)! - `onStateChange` handlers now share one push channel instead of each opening
  its own event stream. With `webSocketTransport()` and a session that supports
  push, state changes arrive over the WebSocket, and the transport resumes from
  the last `pushState` after reconnecting. Otherwise the client opens one event
  stream for each distinct `pingSeconds` value, which now applies only to the
  event stream. With WebSocket push, `onStateChange` resolves once push is enabled on an open
  socket. A handler receives nothing before its `onStateChange` call resolves,
  and a `signal` that aborts while the subscription starts now ends it. The
  handler signature and payloads are unchanged.

- [#275](https://github.com/htunnicliff/json-meta-client/pull/275) [`2d37ca2`](https://github.com/htunnicliff/json-meta-client/commit/2d37ca2c8603fada58887cbd5a6a871eaf994b82) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add the `transport` client option and the public `Transport` interface.
  `transport` takes a `TransportFactory`, which the client calls once with a
  `TransportContext` (`authenticate` and `fetch`). It defaults to the new
  `httpTransport()`, so existing clients behave as before. The package now also
  exports the `JmapRequest`, `JmapResponse`, `Session` and `StateChange` types a
  custom transport needs.

  The Dispatcher now wraps a transport error that isn't a `JsonMetaError` in a
  `CancellationError` once the client is disposed, or a `NetworkError`
  otherwise, with the original as its `cause`. A transport that resolves with
  something other than a JMAP Response rejects the batch with `UnknownError`.
  A JMAP Response body that isn't valid JSON now rejects with a `NetworkError`
  that carries the request, instead of a bare `SyntaxError`.

- [#275](https://github.com/htunnicliff/json-meta-client/pull/275) [`2d37ca2`](https://github.com/htunnicliff/json-meta-client/commit/2d37ca2c8603fada58887cbd5a6a871eaf994b82) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add `webSocketTransport()` for the JMAP WebSocket subprotocol (RFC 8887). Every
  batch of a client shares one socket, which opens on the first batch and closes
  after `idleSeconds` (default 60) with nothing pending. Responses settle by
  `requestId`, a `RequestError` rejects only its own request with `JmapError`,
  and a closed socket rejects requests in flight with `NetworkError`. Pass
  `createWebSocket` to send the headers from `auth`, for example with the `ws`
  package; the default global `WebSocket` sends none. Batches reject with
  `ConfigurationError` when the session doesn't advertise
  `urn:ietf:params:jmap:websocket`.

  A request with no response within `requestTimeoutSeconds` (default 60), or a
  message that can't be parsed, closes the socket and rejects what was waiting
  on it with `NetworkError`. While push is enabled, a `Core/echo` heartbeat
  every `heartbeatSeconds` (default 30) detects a dead socket and reconnects.
  Push reconnects back off from one second to 30 seconds, and the backoff
  resets only once a new socket receives a message.

### Patch Changes

- [#254](https://github.com/htunnicliff/json-meta-client/pull/254) [`8c0d8fb`](https://github.com/htunnicliff/json-meta-client/commit/8c0d8fb6a53af14463f3588884b6e38a8561843d) Thanks [@htunnicliff](https://github.com/htunnicliff)! - `resultRef` now flattens arrays collected by a `*` wildcard, as RFC 8620
  section 3.7 specifies. `thread.resultRef("/list/*/emailIds")` on a
  `Thread/get` call is typed `Ref<string[]>` instead of `Ref<string[][]>`, so
  it can be passed as `ids` to `Email/get`. Pointers whose values are not
  arrays, such as `/list/*/threadId`, are unchanged.

- [#250](https://github.com/htunnicliff/json-meta-client/pull/250) [`c6b38ef`](https://github.com/htunnicliff/json-meta-client/commit/c6b38ef6a9473e6c483a3b365563c3335a90b8b7) Thanks [@htunnicliff](https://github.com/htunnicliff)! - The package README now opens with a json-meta-client banner that links to the
  documentation site, shows npmx badges for the version, license, and bundled
  types, and links to the playground.

## 1.0.0-alpha.2

### Major Changes

- [#214](https://github.com/htunnicliff/json-meta-client/pull/214) [`e6cd57d`](https://github.com/htunnicliff/json-meta-client/commit/e6cd57dd80269fadd121bed2d25d6f6451d388e7) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** method arguments now reject properties that the method doesn't
  declare, at any depth: in `/set` `create` and `update` entries, in filter
  conditions inside `AND`, `OR` and `NOT`, and at the top level. A misspelled
  property, a server-set property, or a filter condition from a capability the
  client doesn't configure previously compiled, because TypeScript skips its
  excess property check for inferred arguments. Arguments that a method leaves
  open, such as `Core/echo`, and result references are not checked.

- [#214](https://github.com/htunnicliff/json-meta-client/pull/214) [`e6cd57d`](https://github.com/htunnicliff/json-meta-client/commit/e6cd57dd80269fadd121bed2d25d6f6451d388e7) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** the published package now ships one bundled entry point.
  `dist/index.mjs` and `dist/index.d.mts` replace the per-file `dist/**/*.js`
  and `.d.ts` output. Imports from `json-meta-client` are unchanged; deep
  imports into `dist/` no longer resolve.

- [#214](https://github.com/htunnicliff/json-meta-client/pull/214) [`e6cd57d`](https://github.com/htunnicliff/json-meta-client/commit/e6cd57dd80269fadd121bed2d25d6f6451d388e7) Thanks [@htunnicliff](https://github.com/htunnicliff)! - **Breaking:** S/MIME types now need the `smime` capability. A client
  configured with `["mail"]` no longer accepts the `smime*` properties in
  `Email/get` or the `hasSmime` and `hasVerifiedSmime` filter conditions in
  `Email/query`, `Email/queryChanges` and `SearchSnippet/get`. Configure
  `["mail", "smime"]` to use them. Configuring `smime` without `mail` now throws
  `CapabilityConfigurationError`, and `SearchSnippet` calls on an S/MIME client
  also send `urn:ietf:params:jmap:smimeverify`.

### Minor Changes

- [#192](https://github.com/htunnicliff/json-meta-client/pull/192) [`f9c8e39`](https://github.com/htunnicliff/json-meta-client/commit/f9c8e3981114343b37f932eb550f214419769061) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add built-in capabilities for JMAP extensions whose types were already
  included:

  - `quota` (RFC 9425): `Quota/get`, `changes`, `query`, and `queryChanges`
  - `sharing` (RFC 9670): `Principal` and `ShareNotification` methods
  - `mdn` (RFC 9007): `MDN/send` and `MDN/parse`. Requests also include
    `urn:ietf:params:jmap:mail`, which RFC 9007 requires for `MDN/send`
  - `smime` (RFC 9219): adds `urn:ietf:params:jmap:smimeverify` to
    `Email` calls so servers return the `smime*` properties and accept the
    S/MIME filters. It adds no methods; enable `mail` alongside it.

  Capabilities can now list other URNs that their methods need in `using`
  with an optional `dependsOn` array, including through
  `defineCapability({ urn, entities, dependsOn })`. The client adds those URNs
  whenever one of the capability's entities is called.

### Patch Changes

- [#200](https://github.com/htunnicliff/json-meta-client/pull/200) [`19565de`](https://github.com/htunnicliff/json-meta-client/commit/19565def0d5ad9a4d0fab4a5ae18c192b0485a33) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Stop warning about a configured capability when the server lists it only in
  an account's `accountCapabilities`. The client now warns only when a URN is
  missing from both the session's `capabilities` and every account's
  `accountCapabilities`. Some servers, such as Stalwart with its
  `urn:stalwart:jmap` management capability, advertise a capability only on the
  accounts that can use it.

- [#197](https://github.com/htunnicliff/json-meta-client/pull/197) [`c172281`](https://github.com/htunnicliff/json-meta-client/commit/c1722814ffe5b93a102a454ff9905fdf680ef1b4) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Fix `cancelBatch()`, and the `cancel` that `isolated()` passes to its callback,
  only working the first time. Every call now rejects the method calls waiting in
  the current batch with a `CancellationError`.

## 1.0.0-alpha.1

### Major Changes

- [#183](https://github.com/htunnicliff/json-meta-client/pull/183) [`f778665`](https://github.com/htunnicliff/json-meta-client/commit/f7786651174de5e74e03f437dd7aea759fb8da34) Thanks [@htunnicliff](https://github.com/htunnicliff)! - BREAKING: Calling a method on an entity that no capability declares, such
  as `client.api.Foo.bar({})`, now rejects with `UnknownEntityError` and is never sent to the server. Previously the call
  was sent without a capability URN in `using`. The error names the entity
  and method; fix it by adding a capability that declares the entity, using a
  built-in capability or `defineCapability`. `Core`, `Blob` and
  `PushSubscription` stay callable without listing `core`. Callers that
  relied on a `beforeJmapRequest` hook to add the URN for an undeclared
  entity must declare the entity with `defineCapability` instead.

- [#188](https://github.com/htunnicliff/json-meta-client/pull/188) [`88ca1cd`](https://github.com/htunnicliff/json-meta-client/commit/88ca1cd840e8d4d3622a1dd7416531edb90509b0) Thanks [@htunnicliff](https://github.com/htunnicliff)! - BREAKING: Remove the unstable `middleware` client option. Passing
  `middleware` to `JsonMetaClient` is now a type error and the option is
  ignored at runtime. The built-in argument transformations (result reference
  keys and `accountId` injection) still run. To change outgoing method calls,
  use a `beforeJmapRequest` hook, which receives the whole request envelope
  including each call's arguments.

## 1.0.0-alpha.0

### Major Changes

- [#170](https://github.com/htunnicliff/json-meta-client/pull/170) [`4787e7a`](https://github.com/htunnicliff/json-meta-client/commit/4787e7aed9d7613a4522c40c50edd54e12647a06) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Release 1.0.0. From this version on, breaking changes bump the
  major version, following semantic versioning.

### Minor Changes

- [#165](https://github.com/htunnicliff/json-meta-client/pull/165) [`b949115`](https://github.com/htunnicliff/json-meta-client/commit/b94911528ea56c5669f494f781cd050cc1ec3055) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add `beforeFetch` / `afterFetch`, `beforeJmapRequest` / `afterJmapResponse`, and `beforeEventSourceConnect` / `afterEventSourceConnect` hooks with sequential async support. Fetch hooks cover every transport; JMAP hooks transform complete batch envelopes; connection hooks run for each event-stream connection or reconnect before messages are read.

  Breaking: remove the `beforeRequest` / `afterResponse` options and the `BeforeRequestHook` / `AfterResponseHook` type exports. The Fetch hook interface is now `beforeFetch` / `afterFetch` with `BeforeFetchHook` / `AfterFetchHook` types.

  Event streams now validate status, content type, and body availability before connection observers run. Connection failures are reported through the state-change handler as `StateChangeError`; intentional aborts remain silent and HTTP 204 still stops reconnects.

- [#150](https://github.com/htunnicliff/json-meta-client/pull/150) [`1741692`](https://github.com/htunnicliff/json-meta-client/commit/1741692b60e4e0b870d9b791f96e4f4077b9e1de) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Use the built-in RFC types for all client and capability contracts.

  Blob, Contacts, and Sieve methods now validate arguments and infer responses. Core exposes the RFC `echo` method. Session metadata and mail inputs now follow the built-in RFC contracts, including required core limits, nullable email address fields, and required mailbox IDs when creating emails.

- [#163](https://github.com/htunnicliff/json-meta-client/pull/163) [`a4cb17a`](https://github.com/htunnicliff/json-meta-client/commit/a4cb17a69a5153864c0eaa42a79f830a180c8ddb) Thanks [@htunnicliff](https://github.com/htunnicliff)! - BREAKING: Replace `bearerToken` with the required `auth` option.
  Migrate `bearerToken: token` to `auth: token`; the old option
  has no compatibility alias. Basic credentials are supported via
  `auth: { username, password }`, with UTF-8/Base64 encoding handled
  by the client. Custom callbacks use
  `auth: ({ request }) => void | Promise<void>` and can mutate the
  outgoing request before it is sent.

  Authentication runs before `beforeFetch` hooks on every
  transport, including session discovery, API calls, blob transfers,
  and event-stream reconnects. Event streams now also run the
  request and response hooks; callbacks are awaited for each
  connection so callers can supply current credentials.

- [`833234c`](https://github.com/htunnicliff/json-meta-client/commit/833234cf727a862497c0fa4b3e5094d9dc96d7c2) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Remove sourcemaps

## 0.14.0

### Minor Changes

- [#135](https://github.com/htunnicliff/json-meta-client/pull/135) [`df1e572`](https://github.com/htunnicliff/json-meta-client/commit/df1e572a242d2fe8ae609effdd7f11e2ca030ade) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Relicense from MIT to MPL-2.0

### Patch Changes

- [#135](https://github.com/htunnicliff/json-meta-client/pull/135) [`df1e572`](https://github.com/htunnicliff/json-meta-client/commit/df1e572a242d2fe8ae609effdd7f11e2ca030ade) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add description, keywords, funding, and homepage to package.json

## 0.13.0

### Minor Changes

- [#115](https://github.com/htunnicliff/json-meta-client/pull/115) [`714890e`](https://github.com/htunnicliff/json-meta-client/commit/714890ee3dc2bdb0c073d894b1eee34351442c67) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add typed session and account details for configured capabilities.

- [`d97c547`](https://github.com/htunnicliff/json-meta-client/commit/d97c547de69620298c5afa5e598721c4328ee944) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add `isolated()` for dedicated batches

- [`aa54389`](https://github.com/htunnicliff/json-meta-client/commit/aa543890efc3a75fda3809f13c76d9f49738cd2c) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Rename `ref()` to `resultRef()`

### Patch Changes

- [`4dccd8d`](https://github.com/htunnicliff/json-meta-client/commit/4dccd8d2840f16ff31d9cde8dfb527ede70c9d90) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Extract built-ins and related types

- [`e03d324`](https://github.com/htunnicliff/json-meta-client/commit/e03d324ee26e93a5d06e4fd3674ff347dd393e58) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add comments to library internals

- [`1fc25e1`](https://github.com/htunnicliff/json-meta-client/commit/1fc25e1e4f1b71d693ec0d9f808dbc21ef579633) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Use a short string of random hexadecimal characters instead of full UUIDs for method call IDs

- [#114](https://github.com/htunnicliff/json-meta-client/pull/114) [`02b9699`](https://github.com/htunnicliff/json-meta-client/commit/02b96993d9a1ad75508f3ef08102d526dbbbbdea) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add typed `createdRef()` creation ID references to pending `/set` results

- [`4dccd8d`](https://github.com/htunnicliff/json-meta-client/commit/4dccd8d2840f16ff31d9cde8dfb527ede70c9d90) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Extract static validation from class

## 0.12.0

### Minor Changes

- [`abd2718`](https://github.com/htunnicliff/json-meta-client/commit/abd271818e1ab99f4589c430a3e0f5e48ae502d7) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add cancelBatch method for clearing a pending batch

- [`190262d`](https://github.com/htunnicliff/json-meta-client/commit/190262dcffac49ba8d9ba4ae3c9cf111f623106a) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add support for custom IDs in method calls

### Patch Changes

- [`18f9521`](https://github.com/htunnicliff/json-meta-client/commit/18f95219c88fc898533194b18ed39205f6193850) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Make ref $props readonly

## 0.11.0

### Minor Changes

- [`b754720`](https://github.com/htunnicliff/json-meta-client/commit/b754720f67c54bd29ab32755f184417b6df88461) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add beforeRequest and afterResponse hooks

- [`30568dc`](https://github.com/htunnicliff/json-meta-client/commit/30568dc315578e61241b9dd7282a2ab226dd2556) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Rename `Client` to `JsonMetaClient`

## 0.10.0

### Minor Changes

- [`619dd67`](https://github.com/htunnicliff/json-meta-client/commit/619dd67717d63e128549ac2b446f0b1adb970e39) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Accept built-in capability export names alongside configured capability objects in client options, preserving inferred API method types.

- [`5215085`](https://github.com/htunnicliff/json-meta-client/commit/52150859f9342cdcd7ca2108b5e22cc54e3fe583) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Enable isolatedDeclarations

- [`a3c1421`](https://github.com/htunnicliff/json-meta-client/commit/a3c142120c56d51ba0cb18e70c5a2146c6c7873e) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Move ref API into method call results

- [`8438af3`](https://github.com/htunnicliff/json-meta-client/commit/8438af3f72fcf0243c3f4c6cd88bf9bce7603055) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add definitive error kinds, including separate HTTP and protocol errors with
  request and response context. Retain the associated method call on JMAP errors
  and validate server response envelopes before processing them.

  Preserve upload body media types instead of forcing JSON request headers.

- [`5215085`](https://github.com/htunnicliff/json-meta-client/commit/52150859f9342cdcd7ca2108b5e22cc54e3fe583) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Stabilize public API

## 0.9.0

### Minor Changes

- [`21262fd`](https://github.com/htunnicliff/json-meta-client/commit/21262fd4b94751b30f7c913ece470d3211a1a303) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Support multiple capabilities augmenting the same entity.

- [`b094589`](https://github.com/htunnicliff/json-meta-client/commit/b0945897639728b29304e955d28f9a4b34f19a13) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Simplify method contract inference boundaries

### Patch Changes

- [`ce377ba`](https://github.com/htunnicliff/json-meta-client/commit/ce377baaabeba76e1cbaba56162d5c57ce99cbb2) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Reject pending method calls when batch processing throws or rejects, and document and test the automatic batching boundaries and failure behavior.

## 0.8.0

### Minor Changes

- [`5a13bb1`](https://github.com/htunnicliff/json-meta-client/commit/5a13bb14dfb81c73fa06218cff3ab299fbaee01f) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added community capabilities with masked email

- [`df55e6f`](https://github.com/htunnicliff/json-meta-client/commit/df55e6fd5dcd353ccaf64568df4e72c356226950) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Use camel case for capability definitions

## 0.7.1

### Patch Changes

- Upgraded pnpm and type-fest

## 0.7.0

### Minor Changes

- [`563d24b`](https://github.com/htunnicliff/json-meta-client/commit/563d24b21c195135d2f9b19651e53b3de8e9b5d4) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added partially-typed sieve capability

- [`4ca6611`](https://github.com/htunnicliff/json-meta-client/commit/4ca6611d841ede1b2782e343c39a3124d78714f2) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Required explicit client capabilities and added a dedicated subpath export (`/capabilities`).

  Made `core` an always-included export.

- [`2917c85`](https://github.com/htunnicliff/json-meta-client/commit/2917c858042cd8e9b8a6078e436ac16d3ee278cb) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added partially typed blob expansion capability

- [`fff6382`](https://github.com/htunnicliff/json-meta-client/commit/fff6382c497ce8548769834960807072019f2e76) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add configurable logger

- [`4bb0cf4`](https://github.com/htunnicliff/json-meta-client/commit/4bb0cf4194758bb32116cd1fd57e160d6f2c43b6) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added runtime options validation

### Patch Changes

- [`bc1cded`](https://github.com/htunnicliff/json-meta-client/commit/bc1cded4464bb0e402814198518a2b42f3d08e0d) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Log warning when capabilities are used but not actually available in a given session

## 0.6.1

### Patch Changes

- [`06ada60`](https://github.com/htunnicliff/json-meta-client/commit/06ada602f2d35f016b3731d075f0f6c500583fda) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Simplify README formatting

## 0.6.0

### Minor Changes

- [`64e2884`](https://github.com/htunnicliff/json-meta-client/commit/64e28841e439104f32c9eb93ed549d2bb862a893) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added any-typed contacts capability

## 0.5.0

### Minor Changes

- [`28cce18`](https://github.com/htunnicliff/json-meta-client/commit/28cce18bbf95063a66190870256be4dff63a06be) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added onStateChange event source handling

- [`28a0d27`](https://github.com/htunnicliff/json-meta-client/commit/28a0d2791cc8b305990dd0d9b27d910014978535) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Added API for blob uploads and downloads

## 0.4.0

### Minor Changes

- [#8](https://github.com/htunnicliff/json-meta-client/pull/8) [`8b52bea`](https://github.com/htunnicliff/json-meta-client/commit/8b52beaaceec33cdac834049e40c0fd13d76cb8b) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Adopt improved contract types and fix broken `{Entity}/get` properties filtering.

## 0.3.3

### Patch Changes

- [#6](https://github.com/htunnicliff/json-meta-client/pull/6) [`83792b0`](https://github.com/htunnicliff/json-meta-client/commit/83792b012b9969236e0a4d532bcd2bbec2f0d932) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Mark the package as side-effect free so bundlers can safely tree-shake unused exports.

## 0.3.2

### Patch Changes

- [`2d1dfa0`](https://github.com/htunnicliff/json-meta-client/commit/2d1dfa06794eac0f270a696192ce9dee94138597) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add license to npm files

## 0.3.1

### Patch Changes

- [`c355ef1`](https://github.com/htunnicliff/json-meta-client/commit/c355ef10ce18cfb32118df4853a1d15fa73a6726) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Add MIT license

- [`67b9b6c`](https://github.com/htunnicliff/json-meta-client/commit/67b9b6c56c96adc69a8ec12b8af12880be24e822) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Improve package.json and bundle settings

## 0.3.0

### Minor Changes

- [`420352f`](https://github.com/htunnicliff/json-meta-client/commit/420352fcae0ac35a9d342a3cb85334749b3ad933) Thanks [@htunnicliff](https://github.com/htunnicliff)! - Significantly flesh out functionality

## 0.2.0

### Minor Changes

- 7b326f8: Ignore test files in publish

## 0.1.1

### Patch Changes

- ff84cca: Update exports
