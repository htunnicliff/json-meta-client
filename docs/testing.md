# Test an application without a server

A mocked HTTP exchange lets you test your application's JMAP calls without
credentials or a running provider. In this walkthrough, you will run a fixture
that serves a session, accepts a batched query and get, and then returns a
method failure. All requests stay inside the process.

Use Node.js 26 and install `json-meta-client` in your project as shown in the
[first-request tutorial](./getting-started.md). The fixture uses Node's built-in assertion
module and needs no test runner.

## 1. Set up a standalone test

Create `testing.mts` and add the four code blocks below in order. Together they
form one runnable file. The test replaces `globalThis.fetch`, so run it in its
own process rather than alongside other code using global fetch.

Start with the client, assertions, and values shared by the mock:

<<< ./snippets/testing.ts#setup

`batches` counts API requests, while `failNext` switches the mock from successful
responses to method errors. `originalFetch` lets the test restore the process
when it finishes.

## 2. Describe the mock account

The client needs a session before it can send API calls. Add a session document
with one primary mail account and URLs served by the mock:

<<< ./snippets/testing.ts#session

Core limits describe what the mock server accepts. The account advertises mail,
and its ID is the primary mail account ID. This lets the test check the client's
default account selection without passing `accountId` in each call.

## 3. Inspect requests and return responses

Replace fetch with a function that serves the session URL and the API URL.
Unexpected URLs fail an assertion rather than reaching a real endpoint:

<<< ./snippets/testing.ts#transport

The API route checks the request's capability requirements, account, and
selected properties. It also checks that the get's `#ids` points to the query
invocation. Responses use the invocation IDs actually sent by the client,
so the test does not depend on generated random strings.

This mock checks the reference on the wire; it does not implement server-side
reference resolution. It returns a chosen query result and a matching email
so the application can read a predictable subject.

## 4. Exercise success and failure

Add the calls and assertions. The first pair should share one API request and
return the subject `Hello`. The second pair receives method errors instead:

<<< ./snippets/testing.ts#exercise

The combined rejection must be a `JmapError`. `Promise.all` attaches handlers
to both calls, so the dependent get's rejection is handled too. The `finally`
block restores fetch whether the assertions pass or fail.

Run the file from your project directory:

```sh
node testing.mts
```

A successful run prints:

```text
Mocked batch, result reference, and method failure passed.
```

## Adapt the fixture to your application

In a test runner, install the mock before constructing the client and restore
it after each test. Do not run tests that replace global fetch concurrently in
the same process. A network interceptor is another option if it supports your
runtime's native `fetch`.

Keep the fixtures focused on decisions your application makes. Empty query
results, missing get IDs, rejected methods, HTTP failures, and per-object set
failures exercise different paths. In particular, test a fulfilled set with
`notCreated` or `notUpdated`: successful HTTP transport does not mean every
write succeeded.

For batching assertions, inspect the request's `using` and `methodCalls`, then
use its actual invocation IDs in the response. Generated IDs are intentionally
variable. A mock does not resolve result references unless you implement that
behaviour; this fixture checks the reference sent by the client and returns a
chosen server result. The [method guide](./features/method-calls.md) and
[error reference](./reference/errors.md) describe the protocol shapes.

## Check provider-specific behaviour separately

Keep a separate suite against a test account for permissions, provider
extensions, and other server behaviour. Do not require live credentials for
routine unit tests. When capturing real responses as fixtures, remove tokens,
message contents, account identifiers, and other private data before committing.

For contributors to this repository, `pnpm test` runs runtime and public type
tests, `pnpm types` checks source types, and `pnpm build` builds the package.
`pnpm test:integration` provisions Stalwart through Testcontainers and needs a
working Docker-compatible runtime plus access to its image. The
[unit fixtures](https://github.com/htunnicliff/json-meta-client/tree/main/src/__test__)
and [integration setup](https://github.com/htunnicliff/json-meta-client/blob/main/src/__test__/integration/setup.ts)
show those approaches.

The documentation has its own checks. `pnpm docs:check` builds the public package,
type-checks each TypeScript fence in README and the manual as an independent
module, checks included TypeScript files, and runs the exact fixture above.
`pnpm docs:build` builds the site and checks page links. CI runs both commands.
Shell commands, JSON, HTML, and other non-TypeScript examples still need review
against their runtime or rendered output.
