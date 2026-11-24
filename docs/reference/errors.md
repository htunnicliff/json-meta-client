# Errors

Every error the library creates extends `JsonMetaError`, which extends
`Error`. Each class comes with a type guard, such as `isHttpError()`, that
narrows an `unknown` value; the guards use `instanceof`, so a guard for a
parent class also matches its subclasses. Classes and guards are exported from
`json-meta-client`.

## Hierarchy

```
Error
└── JsonMetaError
    ├── ConfigurationError
    │   └── CapabilityConfigurationError
    ├── HttpError
    ├── NetworkError
    ├── JmapError
    ├── MethodCallError
    ├── CancellationError
    ├── StateChangeError
    ├── InvalidUriTemplateError
    ├── ResultReferenceError
    ├── UnknownEntityError
    └── UnknownError
```

## Error classes

### `JsonMetaError`

The base class of every error below. Use `isJsonMetaError()` to tell the
library's errors apart from others, such as a `TypeError` thrown by your own
code.

- Type guard: `isJsonMetaError()`

### `ConfigurationError`

The client is configured in a way it can't use.

- Thrown by the constructor when `auth` is not a non-empty token, a username
  and password, or a callback, when `sessionUrl` is not a valid URL, or when
  `capabilities` is not an array
- A method call rejects with it, without being sent, when it passes no
  `accountId` and several accounts support its capability while the session
  names no primary account for it. Pass `accountId` to choose one
- Logged, not thrown, with `console.warn` when the first session lacks a
  configured capability. Refer to
  [Checking server support](../features/capabilities.md#checking-server-support)
- Type guard: `isConfigurationError()`

### `CapabilityConfigurationError`

A subclass of `ConfigurationError` for an invalid entry in `capabilities`. The
constructor throws it for an unknown built-in name, a custom capability with a
missing `urn` or malformed `entities`, `dependsOn` or `defaultAccount`, an
extending capability such as `smime` without the capability it extends, and
two capabilities that claim the same method with different `defaultAccount`
settings.

| Property            | Type                | Description                                    |
| ------------------- | ------------------- | ---------------------------------------------- |
| `givenCapability`   | `unknown`           | The capability name or object that was invalid |
| `availableBuiltIns` | `readonly string[]` | Every built-in capability name                 |

- Type guard: `isCapabilityConfigurationError()`

### `HttpError`

The server answered with a status outside the 200 range. It applies to every
request the client makes: the session, JMAP Requests, blob uploads and
downloads, and event-source connections. Every method call in a failed batch
rejects with the same `HttpError`.

The message is the `detail` of the response's problem details when it has one,
and otherwise `HTTP request failed (<status>)`. Request-level JMAP errors, such
as `urn:ietf:params:jmap:error:unknownCapability`, arrive this way, with their
problem details in `responseData`.

| Property       | Type       | Description                                                       |
| -------------- | ---------- | ----------------------------------------------------------------- |
| `request`      | `Request`  | The request that was sent                                         |
| `response`     | `Response` | The response, with its body unread                                |
| `responseData` | `unknown`  | The body, parsed as JSON for a JSON content type, or else as text |
| `status`       | `number`   | The response's status code                                        |

An event-source connection that answers `200` without a readable
`text/event-stream` body also fails with an `HttpError`.

- Type guard: `isHttpError()`

### `NetworkError`

The request failed before a response arrived, for example because the host
couldn't be reached, or because reading the response body failed. It is also
used when the `auth` callback or a `beforeFetch` or `beforeEventSourceConnect`
hook throws an error that isn't a `JsonMetaError`; the request is then never
sent.

| Property  | Type                   | Description                                                        |
| --------- | ---------------------- | ------------------------------------------------------------------ |
| `request` | `Request \| undefined` | The request, or `undefined` when it couldn't be built from its URL |
| `cause`   | `unknown`              | The original error                                                 |

- Type guard: `isNetworkError()`

### `JmapError`

The server answered a method call with an `error` response (RFC 8620 section
3.6.2). Only that method call rejects; the others in its batch settle from their
own responses.

| Property       | Type                      | Description                                       |
| -------------- | ------------------------- | ------------------------------------------------- |
| `type`         | `string`                  | The error type, such as `invalidArguments`        |
| `detail`       | `string \| undefined`     | The server's description                          |
| `status`       | `number \| undefined`     | A status code, if the server sent one             |
| `limit`        | `string \| undefined`     | The limit that was exceeded, for limit errors     |
| `methodCallId` | `string \| undefined`     | A method call ID, if the server sent one          |
| `instance`     | `string \| undefined`     | A URI for this occurrence, if the server sent one |
| `methodCall`   | `MethodCall \| undefined` | The rejected call's `method`, `args` and `id`     |

The static method `JmapError.isProblemDetails(value)` checks whether a value
has a string `type`, the shape of problem details. Use it to read the
`responseData` of an `HttpError`.

- Type guard: `isJmapError()`

### `MethodCallError`

The response to a method call couldn't be used: the JMAP Response has no
invocation with the call's ID, the invocation names a different method, or an
`error` invocation has no string `type`.

| Property       | Type         | Description                                 |
| -------------- | ------------ | ------------------------------------------- |
| `methodCall`   | `MethodCall` | The call's `method`, `args` and `id`        |
| `responseData` | `unknown`    | The response arguments, when there were any |

- Type guard: `isMethodCallError()`

### `CancellationError`

A method call was waiting in a batch that [`cancelBatch()`](./api.md#cancelbatch)
or an [`isolated()`](./api.md#isolated) `cancel` function cancelled. The call
was never sent.

- Type guard: `isCancellationError()`

### `StateChangeError`

Passed as the first argument of an [`onStateChange()`](./api.md#onstatechange)
handler, never thrown. It reports a failed event-source connection or an
unreadable message, and its `cause` holds the original error, such as an
`HttpError`, `NetworkError` or `SyntaxError`. The subscription stays open.

- Type guard: `isStateChangeError()`

### `InvalidUriTemplateError`

A URL template from the session lacks a variable the client needs to fill:
`{accountId}` in `uploadUrl`, any of the download parameters in
`downloadUrl`, or `{types}`, `{closeafter}` or `{ping}` in `eventSourceUrl`.
[`blob.upload()`, `blob.download()`](./api.md#blob-upload-blob-download) and
[`onStateChange()`](./api.md#onstatechange) reject with it.

| Property              | Type                     | Description                             |
| --------------------- | ------------------------ | --------------------------------------- |
| `uriTemplate`         | `string`                 | The template from the session           |
| `givenParameters`     | `Record<string, string>` | The values the client tried to fill in  |
| `availableParameters` | `readonly string[]`      | The variables the template does contain |

- Type guard: `isInvalidUriTemplateError()`

### `ResultReferenceError`

A method call breaks a result reference rule of RFC 8620 section 3.7. The call
rejects before it is sent, and the rest of its batch proceeds.

| Property     | Type         | Description                |
| ------------ | ------------ | -------------------------- |
| `reason`     | `string`     | Which rule the call breaks |
| `methodCall` | `MethodCall` | The rejected call          |

| `reason`               | Meaning                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `"nested"`             | A result reference sits inside an argument rather than being one |
| `"duplicate-argument"` | An argument is given both as a value and as a result reference   |
| `"cross-batch"`        | The reference names a call that isn't earlier in the same batch  |
| `"duplicate-id"`       | Another call in the same batch has the same method call ID       |

A call that references a rejected call is still sent, and the server answers
it with an `invalidResultReference` method error.

- Type guard: `isResultReferenceError()`

### `UnknownEntityError`

A call on `client.api` names an entity that no configured capability declares,
such as `client.api.Note.get()` without a capability for `Note`. The returned
promise rejects and the call is never sent. The types normally catch this
first.

| Property | Type     | Description                |
| -------- | -------- | -------------------------- |
| `entity` | `string` | The entity that was called |
| `method` | `string` | The method that was called |

- Type guard: `isUnknownEntityError()`

### `UnknownError`

A fallback for an error the library can't classify. The client does not raise
it in normal operation: `JmapError`'s constructor throws it when given a cause
that isn't problem details.

- Type guard: `isUnknownError()`

## Errors not wrapped by the library

A few failures reach you as they are, without a `JsonMetaError` around them:

- **Malformed JSON.** A successful response whose body isn't valid JSON
  rejects with the `SyntaxError` from `JSON.parse`.
- **`afterFetch` hook errors.** An error thrown by an `afterFetch` or
  `afterEventSourceConnect` hook passes through unchanged. So does a
  `JsonMetaError` thrown by a `beforeFetch` hook; any other error from a
  before hook becomes a `NetworkError`. Refer to
  [Errors in hooks](../advanced/hooks.md#errors-in-hooks).
- **Invalid calls.** `createdRef()` throws a `RangeError` for a creation ID
  that isn't in the call's `create` argument. A method call throws a
  `TypeError` when its arguments aren't an object, or when
  `generateMethodCallId` returns something other than a string. These are
  thrown synchronously, when the call is made.

## Handling patterns

A method call rejects with an `HttpError` or `NetworkError` when its whole
batch fails, and with a `JmapError` when the server rejects that call alone.
Check the narrowest cases first:

```ts
import {
  isHttpError,
  isJmapError,
  isNetworkError,
  JmapError,
} from "json-meta-client";

try {
  await client.api.Email.query({
    filter: { inMailbox: "unknown" },
  });
} catch (error) {
  if (
    isJmapError(error) &&
    error.type === "invalidArguments"
  ) {
    console.error(
      "The server rejected the arguments:",
      error.detail,
    );
  } else if (isHttpError(error)) {
    const problem = JmapError.isProblemDetails(
      error.responseData,
    )
      ? error.responseData.type
      : undefined;
    console.error(
      `The request failed with ${error.status}`,
      problem,
    );
  } else if (isNetworkError(error)) {
    console.error(
      "The server could not be reached:",
      error.cause,
    );
  } else {
    throw error;
  }
}
```

Errors for individual objects in a `/set` call, such as a `notCreated` entry,
are part of a successful response, so they don't reject the call. Read them
from the result's `notCreated`, `notUpdated` and `notDestroyed` properties.

### Request-level error types

These arrive as an `HttpError` whose `responseData.type` is one of:

| `type`                                         | Meaning                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `urn:ietf:params:jmap:error:unknownCapability` | `using` names a capability the server doesn't support             |
| `urn:ietf:params:jmap:error:notJSON`           | The body isn't valid JSON                                         |
| `urn:ietf:params:jmap:error:notRequest`        | The body isn't a valid JMAP Request                               |
| `urn:ietf:params:jmap:error:limit`             | The request exceeds a server limit, named in `responseData.limit` |

### Method-level error types

These arrive as a `JmapError` whose `type` is one of the following, among
others that individual methods define:

| `type`                        | Meaning                                                             |
| ----------------------------- | ------------------------------------------------------------------- |
| `serverUnavailable`           | A temporary server problem; the call can be retried later           |
| `serverFail`                  | An unexpected server error                                          |
| `serverPartialFail`           | Some changes were made before the error; resynchronize              |
| `unknownMethod`               | The server doesn't recognize the method                             |
| `invalidArguments`            | An argument is missing, has the wrong type, or is otherwise invalid |
| `invalidResultReference`      | A result reference couldn't be resolved                             |
| `forbidden`                   | The user may not perform the call                                   |
| `accountNotFound`             | The `accountId` doesn't match an account                            |
| `accountNotSupportedByMethod` | The account doesn't support the method                              |
| `accountReadOnly`             | The call would change a read-only account                           |
| `requestTooLarge`             | A `/get` or `/set` call names too many objects                      |
| `stateMismatch`               | `ifInState` doesn't match the current state                         |
| `cannotCalculateChanges`      | The server can't compute changes from the given state; refetch      |
| `anchorNotFound`              | A `/query` call's `anchor` isn't in the results                     |
| `unsupportedSort`             | A `/query` call's `sort` isn't supported                            |
| `unsupportedFilter`           | A `/query` call's `filter` isn't supported                          |
| `tooManyChanges`              | More changes than `maxChanges` allows                               |
| `fromAccountNotFound`         | A `/copy` call's `fromAccountId` doesn't match an account           |
