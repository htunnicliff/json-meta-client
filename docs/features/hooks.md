# Hooks

HTTP hooks let you adjust outgoing requests and examine incoming responses. They apply to session retrieval, batched method requests, and blob transfers.

## Modify a request

Add a function to `hooks.beforeRequest`. Return the request that should be sent, either immediately or through a promise:

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  bearerToken: "<bearer-token>",
  capabilities: ["mail"],
  hooks: {
    beforeRequest: [
      ({ request }) => {
        request.headers.set("x-application", "mail-reader");
        return request;
      },
    ],
  },
});
```

The bearer authorization header is already set when this hook runs. Take care with request logging because it can expose credentials and private request bodies.

## Inspect a response

An `afterResponse` hook receives the request and response, and must return a `Response`:

```ts
import type { AfterResponseHook } from "json-meta-client";

const reportStatus: AfterResponseHook = ({ request, response }) => {
  console.log(request.method, response.status);
  return response;
};
```

Install it with `hooks: { afterResponse: [reportStatus] }` in the client configuration. This hook runs before the client checks `response.ok`, so it sees unsuccessful HTTP responses too.

Read `response.clone()` if you need to inspect a body. Consuming the original body leaves it unavailable to the client or to the caller of `blob.download()`.

## Compose several hooks

Each hook array runs in order. The client awaits a hook before invoking the next, and passes along the returned request or response. Always return the appropriate object, even if the hook only records a metric.

Before-request hooks run before Fetch. After-response hooks run once Fetch has returned a response; they do not run when sending the request fails.

## Understand scope and errors

Event streams use their own connection and bypass these hooks. To transform method arguments before batching, see the separate, unstable `middleware` option in [Configuration](../reference/configuration.md).

An exception in a before-request hook becomes a `NetworkError` unless it already extends `JsonMetaError`. An exception in an after-response hook propagates unchanged. Either failure can reject all method promises that share the affected request.
