# Hooks

HTTP hooks let you modify requests and inspect responses for session loading, method-call requests, and blob transfers.

## Before a Request

Add functions to `hooks.beforeRequest`. Each receives `{ request }` and must return a `Request`, directly or through a promise:

```ts
const client = new JsonMetaClient({
  bearerToken: "<bearer-token>",
  sessionUrl: "https://your-provider.example/.well-known/jmap",
  capabilities: ["mail"],
  hooks: {
    beforeRequest: [
      ({ request }) => {
        request.headers.set("x-app-name", "my-jmap-app");
        return request;
      },
    ],
  },
});
```

The authorization header is already present when these hooks run. Avoid logging it.

## After a Response

Add functions to `hooks.afterResponse`. Each receives `{ request, response }` and must return a `Response`:

```ts
import type { Config } from "json-meta-client";

const hooks: Config<["mail"]>["hooks"] = {
  afterResponse: [
    ({ response }) => {
      console.log(response.status);
      return response;
    },
  ],
};
```

These hooks run before the client checks `response.ok`. To inspect a body, read `response.clone()` so the client can still consume the original.

## Order and Scope

Hooks run in array order and are awaited. Each hook receives the request or response returned by the previous hook.

Event streams use a separate connection and do not run these hooks. Hooks also differ from the unstable `middleware` option, which transforms method arguments; see [Configuration](../reference/configuration.md).

## Failures

A thrown `beforeRequest` error is wrapped in `NetworkError` unless it is already a library error. A thrown `afterResponse` error propagates directly. Either can reject all method calls sharing the affected HTTP request.
