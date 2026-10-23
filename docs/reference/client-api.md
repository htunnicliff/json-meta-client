# API

## JsonMetaClient

> TODO: Add the constructor signature and link to Configuration for full option details.

```ts
const client = new JsonMetaClient({
  bearerToken: "<token>",
  sessionUrl: "<url>",
  capabilities: ["mail", "contacts"],
});
```

### Parameters

> TODO: Complete current option descriptions; replace the obsolete logger entry with hooks and label middleware unstable.

- `bearerToken` - A valid bearer token
- `sessionUrl` - The URI for creating a JMAP session
- `capabilities` - An array of capabilities
- `logger` (optional) -
- `middleware` (optional) -

## Return Value

> TODO: Describe the client instance and its public members below.

## api

> TODO: Document entity/method calls, args, options.id, returned promise metadata, and .ref(); link to Method Calls.

## session and refreshSession()

> TODO: Document `Promise<Session>`, lazy caching, explicit refresh, and capability validation on first successful load.

## blob.upload() and blob.download()

> TODO: List signatures, parameters, defaults, and return types; link to Blobs.

## onStateChange()

> TODO: List callback signature, options, `Promise<Disposable>` return, and cleanup; link to Events.

## cancelBatch()

> TODO: Document queued-call cancellation, CancellationError, and limits for in-flight requests and later calls.
