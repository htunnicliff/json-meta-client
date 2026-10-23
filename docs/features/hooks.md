# Hooks

> TODO: Show the hooks configuration shape and distinguish HTTP hooks from unstable method-argument middleware.

## `beforeRequest`

> TODO: Outline ({ request }) => `Request | Promise<Request>`; show adding a header and returning the request.

## `afterResponse`

> TODO: Outline ({ request, response }) => `Response | Promise<Response>`; show inspecting a cloned response and returning it.

## Order and Scope

> TODO: Explain ordered, awaited hook arrays for session, API, and blob fetches; exclude the event stream.

## Failures and Response Bodies

> TODO: Explain hook error propagation and cloning bodies before reading them; avoid logging bearer tokens.
