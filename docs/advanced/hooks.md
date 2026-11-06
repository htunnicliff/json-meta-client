# Hooks

Use HTTP hooks to customise headers, observe responses, or replace
transport objects. Configure readonly arrays under `hooks` when
constructing the client. Each hook must return the object to pass
to the next hook; returning nothing is not a pass-through.

## Set headers and inspect responses

```ts
import { JsonMetaClient } from "json-meta-client";

const client = new JsonMetaClient({
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
  auth: { token: "YOUR_ACCESS_TOKEN" },
  capabilities: ["mail"],
  hooks: {
    beforeRequest: [
      ({ request }) => {
        request.headers.set("X-Client", "my-app");
        return request;
      },
    ],
    afterResponse: [
      async ({ request, response }) => {
        console.log(
          request.method,
          request.url,
          response.status,
        );
        // Read only bounded JSON responses; never consume an event stream.
        if (
          response.headers
            .get("content-type")
            ?.includes("application/json")
        ) {
          console.log(await response.clone().json());
        }
        return response;
      },
    ],
  },
});
await client.session;
```

Only log response bodies when their contents are appropriate for
your application's logs. Cloning preserves the original body for
the caller; large responses can still increase memory use.

## Timing, chaining, and scope

`beforeRequest({ request })` returns `Request | Promise<Request>`.
`afterResponse({ request, response })` returns
`Response | Promise<Response>`. Synchronous and asynchronous hooks
can be mixed. Arrays run in registration order, awaiting each
hook, and each replacement becomes the next hook's input.

For each HTTP operation:

1. The client constructs a web `Request`.
2. [Authentication](../features/authentication.md) mutates it.
3. `beforeRequest` hooks run, then `fetch` sends the final request.
4. `afterResponse` hooks receive a clone of that sent request and
   the response, including unsuccessful HTTP statuses.
5. HTTP status validation runs, then JSON bodies are parsed where
   the operation expects JSON.

The same path covers session retrieval and `refreshSession()`,
batched JMAP requests, uploads, downloads, and every event-stream
connection/reconnect. Reading a cached session makes no HTTP
request. An SSE hook must preserve the streaming body and avoid
waiting for the stream to finish. HTTP hooks run once per batch,
not once per method, and do not observe individual state callbacks.

A request hook may replace a request with `new Request(request,
options)`. Keep transport headers, method/body and abort signal
when copying it; those are particularly important for SSE. Request
hooks run after authentication and can override its headers.

## Failures

An ordinary error thrown/rejected by authentication or a request
hook is wrapped in `NetworkError` with its original `cause`;
existing `JsonMetaError` instances pass through. No request is sent
when that stage fails. An error thrown/rejected by a response hook
propagates unchanged; it runs before status validation, so it can
hide the usual `HttpError` if it throws first.

A shared transport failure rejects every method in that HTTP
batch. Event-stream failures instead enter the transport's
reconnection path; see [Events](../features/events.md). These hooks
do not implement retry policy for ordinary requests. See the
[API](../reference/api.md) and [error](../reference/errors.md)
references for signatures and error fields.

## Method middleware and future migration

The implementation exposes only these two HTTP hooks. Existing
`Config.middleware` transforms individual JMAP calls and is marked
**unstable**. Its types are inferred from `Config`; there is no
public `Middleware` export. Built-in result-reference rewriting and
lazy mail-account injection run before custom middleware. Do not
copy argument objects before the session loads: doing so can
access the lazy `accountId` getter. HTTP hooks are the supported
place for header and transport customisation.

[Proposal #112](https://github.com/htunnicliff/json-meta-client/issues/112)
plans method hooks and middleware removal. Its proposed
`beforeMethodCall` and `afterMethodResponse` are not available in
this package. When that proposal ships, reconcile this guide's
ordering, failure scope and migration section, and the hook entries
in [API](../reference/api.md) and [Types](../reference/types.md),
with its final implementation. Follow the proposal for design
context rather than copying proposed code into applications.
