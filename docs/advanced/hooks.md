# Hooks

Configure hooks through the `hooks` option. They apply to
session discovery, API requests, blob transfers, and every
event-stream connection or reconnect.

`beforeRequest` hooks run **after authentication**, in array
order. Each hook receives `{ request }` and must return a
`Request` or `Promise<Request>`. Its returned request is used
by the next hook and ultimately sent to the server. Hooks can
inspect or override authentication headers.

```ts
const client = new JsonMetaClient({
  sessionUrl,
  capabilities: ["mail"],
  auth: { token },
  hooks: {
    beforeRequest: [
      ({ request }) => {
        request.headers.set("X-Client", "my-app");
        return request;
      },
    ],
    afterResponse: [
      ({ request, response }) => {
        console.log(request.url, response.status);
        return response;
      },
    ],
  },
});
```

`afterResponse` hooks receive `{ request, response }`, run in
array order, and return a `Response` or `Promise<Response>`.
The request is a clone of the request sent; each returned
response is passed to the next hook. Hooks run before HTTP
status validation and response parsing. For event streams,
return a response whose body remains available for streaming.

See [Authentication](../features/authentication.md) for
credential configuration and the complete ordering.
