# Errors

## Hierarchy

:::warning TODO
- Base class `JsonMetaError`
- Subclasses: `ConfigurationError` (and its subclasses `CapabilityConfigurationError` and `UnknownEntityError`),
  `HttpError`, `NetworkError`, `JmapError`, `MethodCallError`, `CancellationError`,
  `StateChangeError`, `InvalidUriTemplateError`, `UnknownError`
:::

## One section per class

:::warning TODO
- When it is thrown, its extra properties, and its `is*Error` type guard
- Extra properties:
  - `HttpError`: `request`, `response` (body unread), `responseData`, `status`;
    message comes from the problem `detail` when present
  - `NetworkError`: `request` (may be `undefined`), `cause`
  - `JmapError`: `type`, `detail`, `status`, `limit`, `methodCallId`, `instance`,
    `methodCall`, plus static `isProblemDetails`
  - `MethodCallError`: `methodCall`, `responseData`
  - `CapabilityConfigurationError`: `givenCapability`, `availableBuiltIns`
  - `UnknownEntityError`: `entity`, `method`; the returned promise rejects when an API call
    names an entity no capability declares, and the call is never sent
  - `InvalidUriTemplateError`: `uriTemplate`, `givenParameters`, `availableParameters`
:::

## Errors not wrapped by the library

:::warning TODO
- Malformed JSON in a successful response rejects with a plain `SyntaxError`
- Errors thrown by `afterFetch` hooks pass through unchanged
- `createdRef` throws `RangeError`
- Middleware returning a non-object throws `TypeError`
:::

## Handling patterns

:::warning TODO
- Example distinguishing an HTTP failure, a JMAP method error
  (`type === "invalidArguments"`), and a network failure
- List common JMAP request-level and method-level `type` values
:::
