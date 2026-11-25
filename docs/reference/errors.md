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
    ├── CreationReferenceError
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

The client's configuration can't be used as given, such as an invalid option
passed to the constructor, or a method call whose account can't be
determined from the configuration and session. Its message says what to
change.

- Type guard: `isConfigurationError()`

### `CapabilityConfigurationError`

A subclass of `ConfigurationError` for a problem with the `capabilities`
option, such as an unknown built-in name or a malformed custom capability.

| Property            | Type                | Description                                    |
| ------------------- | ------------------- | ---------------------------------------------- |
| `givenCapability`   | `unknown`           | The capability name or object that was invalid |
| `availableBuiltIns` | `readonly string[]` | Every built-in capability name                 |

- Type guard: `isCapabilityConfigurationError()`

### `HttpError`

The server answered a request with an unsuccessful HTTP response. When the
request carried a batch, every method call in it rejects with the same error.
Request-level JMAP errors arrive this way, with their problem details in
`responseData`.

| Property       | Type       | Description                                                       |
| -------------- | ---------- | ----------------------------------------------------------------- |
| `request`      | `Request`  | The request that was sent                                         |
| `response`     | `Response` | The response, with its body unread                                |
| `responseData` | `unknown`  | The body, parsed as JSON for a JSON content type, or else as text |
| `status`       | `number`   | The response's status code                                        |

- Type guard: `isHttpError()`

### `NetworkError`

A request failed without a usable HTTP response, for example because the
server couldn't be reached. `cause` holds the underlying error.

| Property  | Type                   | Description                                                        |
| --------- | ---------------------- | ------------------------------------------------------------------ |
| `request` | `Request \| undefined` | The request, or `undefined` when it couldn't be built from its URL |
| `cause`   | `unknown`              | The original error                                                 |

- Type guard: `isNetworkError()`

### `JmapError`

The server answered a method call with a method-level error (RFC 8620 section
3.6.2). Only that method call rejects; the others in its batch settle from
their own responses.

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

The server's response to a method call couldn't be matched to the call or
understood, so the client can't settle it with a result or a `JmapError`.

| Property       | Type         | Description                                 |
| -------------- | ------------ | ------------------------------------------- |
| `methodCall`   | `MethodCall` | The call's `method`, `args` and `id`        |
| `responseData` | `unknown`    | The response arguments, when there were any |

- Type guard: `isMethodCallError()`

### `CancellationError`

A method call was cancelled before its batch was sent, for example with
[`cancelBatch()`](./api.md#cancelbatch).

- Type guard: `isCancellationError()`

### `StateChangeError`

A problem with a state change subscription. It is passed to the
[`onStateChange()`](./api.md#onstatechange) handler rather than thrown, and its
`cause` holds the underlying error.

- Type guard: `isStateChangeError()`

### `InvalidUriTemplateError`

A URL template from the session, such as `uploadUrl` or `downloadUrl`, lacks
a variable the client needs to fill in. This usually points to a server that
doesn't follow RFC 8620.

| Property              | Type                     | Description                             |
| --------------------- | ------------------------ | --------------------------------------- |
| `uriTemplate`         | `string`                 | The template from the session           |
| `givenParameters`     | `Record<string, string>` | The values the client tried to fill in  |
| `availableParameters` | `readonly string[]`      | The variables the template does contain |

- Type guard: `isInvalidUriTemplateError()`

### `ResultReferenceError`

A method call uses a result reference in a way RFC 8620 section 3.7 doesn't
allow. The call rejects before it is sent, and the rest of its batch proceeds.

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

- Type guard: `isResultReferenceError()`

### `CreationReferenceError`

A creation ID can't be referenced the way RFC 8620 section 5.3 allows.
`createdRef()` throws it synchronously for the reasons `"unknown-id"` and
`"batch-sent"`. A call that reuses a creation ID rejects with it before it
is sent, and the rest of its batch proceeds.

| Property     | Type         | Description                                    |
| ------------ | ------------ | ---------------------------------------------- |
| `reason`     | `string`     | Which rule is broken                           |
| `methodCall` | `MethodCall` | The call that creates, or would create, the ID |
| `creationId` | `string`     | The creation ID                                |

| `reason`         | Meaning                                                                   |
| ---------------- | ------------------------------------------------------------------------- |
| `"unknown-id"`   | The `/set` call's `create` has no such key                                |
| `"batch-sent"`   | The `/set` call's batch was already sent, so no later call can use the ID |
| `"duplicate-id"` | An earlier call in the same batch already uses the creation ID            |

- Type guard: `isCreationReferenceError()`

### `UnknownEntityError`

A call on `client.api` names an entity that no configured capability
declares. The call is never sent. The types normally catch this first.

| Property | Type     | Description                |
| -------- | -------- | -------------------------- |
| `entity` | `string` | The entity that was called |
| `method` | `string` | The method that was called |

- Type guard: `isUnknownEntityError()`

### `UnknownError`

A fallback for an error the library can't classify.

- Type guard: `isUnknownError()`

## Errors not wrapped by the library

Not every error is a `JsonMetaError`. Errors from your own code, such as a
hook, and some errors from the platform, such as a `SyntaxError` for a
response that isn't valid JSON, can reach you as they are. A mistake in how
a method is called, such as an invalid argument, may also throw a standard
`TypeError` or `RangeError` at the call site. Use `isJsonMetaError()` to tell
the library's errors apart, and refer to
[Errors in hooks](../advanced/hooks.md#errors-in-hooks) for errors thrown by
hooks.

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

RFC 8620 defines these request-level types. They arrive in the `responseData.type` of an `HttpError`:

| `type`                                         | Meaning                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `urn:ietf:params:jmap:error:unknownCapability` | `using` names a capability the server doesn't support             |
| `urn:ietf:params:jmap:error:notJSON`           | The body isn't valid JSON                                         |
| `urn:ietf:params:jmap:error:notRequest`        | The body isn't a valid JMAP Request                               |
| `urn:ietf:params:jmap:error:limit`             | The request exceeds a server limit, named in `responseData.limit` |

### Method-level error types

RFC 8620 defines these common method-level types, and other specifications
add more. They arrive as the `type` of a `JmapError`:

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
