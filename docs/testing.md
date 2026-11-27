# Testing

Code that uses the client can be tested without a JMAP server. The client
makes every HTTP request through the global `fetch`, so a test can answer
those requests itself. The examples on this page use
[Vitest](https://vitest.dev/), but the same approach works with any test
runner.

## Mocking the network

The client calls `fetch` with a single
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request)
argument. It first gets the session from `sessionUrl`, then posts each batch
of method calls to the session's `apiUrl` as a JMAP Request.

A fake server needs a session to answer with. The client reads these parts
of it:

- `apiUrl`, where it posts method calls.
- `uploadUrl` and `downloadUrl`, the URL templates for
  [blob transfers](./features/blobs.md).
- `eventSourceUrl`, the URL template for
  [state changes](./features/events.md).
- `primaryAccounts`, which gives method calls their default `accountId`.
  Include the URN of each capability the client is configured with.
- `accounts`, each with its `accountCapabilities`. The client reads them
  when a URN has no primary account, and when it checks that the server
  supports the configured capabilities.
- `capabilities`. The client warns when a configured capability is missing
  from both `capabilities` and every account. RFC 8620 also requires
  `urn:ietf:params:jmap:core` here, with the server's limits.

```ts
import type { Config } from "json-meta-client";
import { JsonMetaClient } from "json-meta-client";
import { afterEach, vi } from "vitest";

const sessionUrl =
  "https://jmap.example.test/.well-known/jmap";
const mailUrn = "urn:ietf:params:jmap:mail";

const session = {
  apiUrl: "https://jmap.example.test/api",
  uploadUrl: "https://jmap.example.test/upload/{accountId}",
  downloadUrl:
    "https://jmap.example.test/download/{accountId}/{blobId}/{name}?type={type}",
  eventSourceUrl:
    "https://jmap.example.test/events?types={types}&closeafter={closeafter}&ping={ping}",
  primaryAccounts: { [mailUrn]: "A1" },
  accounts: {
    A1: {
      name: "test@example.test",
      isPersonal: true,
      isReadOnly: false,
      accountCapabilities: { [mailUrn]: {} },
    },
  },
  capabilities: {
    "urn:ietf:params:jmap:core": {
      maxSizeUpload: 50_000_000,
      maxConcurrentUpload: 4,
      maxSizeRequest: 10_000_000,
      maxConcurrentRequests: 4,
      maxCallsInRequest: 16,
      maxObjectsInGet: 256,
      maxObjectsInSet: 128,
      collationAlgorithms: [],
    },
    [mailUrn]: {},
  },
  username: "test@example.test",
  state: "session-1",
};

type Invocation = [
  name: string,
  args: Record<string, unknown>,
  callId: string,
];

/**
 * Answer the session request with the fake session, and each JMAP
 * Request with the method responses that `respond` returns
 */
function serve(
  respond: (methodCalls: Invocation[]) => Invocation[],
) {
  const fetch = vi.fn(async (request: Request) => {
    if (request.url === sessionUrl) {
      return Response.json(session);
    }
    const { methodCalls } = await request.json();
    return Response.json({
      methodResponses: respond(methodCalls),
      sessionState: session.state,
    });
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

function createClient(
  options: Partial<Config<["mail"]>> = {},
) {
  return new JsonMetaClient({
    sessionUrl,
    auth: "test-token",
    capabilities: ["mail"],
    ...options,
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});
```

Create a new client in each test. A client fetches the session once and
caches it, including a failed fetch, so a client shared between tests carries
one test's session into the next.

With the server in place, a test answers the calls it expects and checks
what the code under test does with the results:

```ts
import { expect, test } from "vitest";

test("finds the inbox", async () => {
  serve((methodCalls) =>
    methodCalls.map(([name, , callId]) => [
      name,
      {
        accountId: "A1",
        queryState: "q1",
        canCalculateChanges: false,
        position: 0,
        ids: ["M1"],
      },
      callId,
    ]),
  );

  const { ids } = await createClient().api.Mailbox.query({
    filter: { role: "inbox" },
  });

  expect(ids).toEqual(["M1"]);
});
```

Instead of stubbing `fetch` by hand, you can intercept requests with a
library such as [MSW](https://mswjs.io/) or
[nock](https://github.com/nock/nock). The library's own tests use nock.

## Predictable call IDs

The server answers each method call with the call's ID, and the client
settles each pending call from the response with its ID. By default the
client makes IDs like `Mailbox/query::3f9a1c02`, with random hex digits, so
a test can't write them out ahead of time. There are three ways to know
them.

Every pending method call has `$id` and `$method` properties. Make the calls
first, then answer each by its ID:

```ts
test("lists unread emails", async () => {
  const client = createClient();

  const queryUnread = client.api.Email.query({
    filter: { notKeyword: "$seen" },
  });
  const getUnread = client.api.Email.get({
    ids: queryUnread.resultRef("/ids"),
    properties: ["subject"],
  });

  serve(() => [
    [
      queryUnread.$method,
      {
        accountId: "A1",
        queryState: "q1",
        canCalculateChanges: false,
        position: 0,
        ids: ["E1"],
      },
      queryUnread.$id,
    ],
    [
      getUnread.$method,
      {
        accountId: "A1",
        state: "e1",
        list: [{ id: "E1", subject: "Hello" }],
        notFound: [],
      },
      getUnread.$id,
    ],
  ]);

  const { list } = await getUnread;

  expect(list).toEqual([{ id: "E1", subject: "Hello" }]);
});
```

The calls aren't sent until the current task yields, so serving them right
after they are made is early enough.

To choose a call's ID yourself, pass `{ id }` as the second argument. It
replaces the generated ID for that call:

```ts
test("queries mailboxes by role", async () => {
  serve(() => [
    [
      "Mailbox/query",
      {
        accountId: "A1",
        queryState: "q1",
        canCalculateChanges: false,
        position: 0,
        ids: ["M2"],
      },
      "drafts",
    ],
  ]);

  const { ids } = await createClient().api.Mailbox.query(
    { filter: { role: "drafts" } },
    { id: "drafts" },
  );

  expect(ids).toEqual(["M2"]);
});
```

To make every ID predictable, give the client a
[`generateMethodCallId`](./reference/api.md#generatemethodcallid-optional)
function. A counter that starts again for each client gives the same IDs in
every run, which keeps snapshots stable:

```ts
function createCountingClient(
  options: Partial<Config<["mail"]>> = {},
) {
  let calls = 0;
  return createClient({
    generateMethodCallId: () => `c${calls++}`,
    ...options,
  });
}
```

## Inspecting requests

To check what the client sends, capture the JMAP Request with a
[`beforeJmapRequest`](./advanced/hooks.md#beforejmaprequest-afterjmapresponse)
hook. It receives the request just before it is serialized, with every
default `accountId` filled in. Return it unchanged, then compare it with an
inline snapshot:

```ts
test("asks for the inbox by role", async () => {
  const sent: unknown[] = [];
  const client = createCountingClient({
    hooks: {
      beforeJmapRequest: [
        ({ jmapRequest }) => {
          sent.push(jmapRequest);
          return jmapRequest;
        },
      ],
    },
  });

  serve((methodCalls) =>
    methodCalls.map(([name, , callId]) => [
      name,
      {},
      callId,
    ]),
  );

  await client.api.Mailbox.query({
    filter: { role: "inbox" },
  });

  expect(sent).toMatchInlineSnapshot(`
    [
      {
        "methodCalls": [
          [
            "Mailbox/query",
            {
              "accountId": "A1",
              "filter": {
                "role": "inbox",
              },
            },
            "c0",
          ],
        ],
        "using": [
          "urn:ietf:params:jmap:core",
          "urn:ietf:params:jmap:mail",
        ],
      },
    ]
  `);
});
```

To check the HTTP request itself, such as its headers, use a
[`beforeFetch`](./advanced/hooks.md#beforefetch-afterfetch) hook instead. It
runs for every request, including the session request, and must leave the
body unread: read a clone, as in `await httpRequest.clone().json()`. The
`fetch` mock that `serve` returns also records each `Request` it receives.

## Simulating errors

A method call fails on its own when the server answers it with an `error`
response. The call rejects with a `JmapError` whose `type` is the error's
type, while the other calls in the batch still resolve. Check the error with
`isJmapError`:

```ts
import { isHttpError, isJmapError } from "json-meta-client";
import { assert } from "vitest";
```

```ts
test("reports a missing account", async () => {
  serve((methodCalls) =>
    methodCalls.map(([, , callId]) => [
      "error",
      { type: "accountNotFound" },
      callId,
    ]),
  );

  const error = await createClient()
    .api.Mailbox.get({ accountId: "A2" })
    .catch((error: unknown) => error);

  assert(isJmapError(error));
  expect(error.type).toBe("accountNotFound");
});
```

When the HTTP response isn't successful, every call in the batch rejects
with an `HttpError`. Its `status` is the response status, and its message is
the `detail` of a problem details body, when the server sends one:

```ts
test("reports a rejected request", async () => {
  vi.stubGlobal("fetch", async (request: Request) =>
    request.url === sessionUrl
      ? Response.json(session)
      : Response.json(
          {
            type: "urn:ietf:params:jmap:error:limit",
            limit: "maxCallsInRequest",
            status: 400,
            detail: "Too many method calls",
          },
          { status: 400 },
        ),
  );

  const error = await createClient()
    .api.Mailbox.get()
    .catch((error: unknown) => error);

  assert(isHttpError(error));
  expect(error.status).toBe(400);
  expect(error.message).toBe("Too many method calls");
});
```

A `fetch` that throws, as it does when the server can't be reached, rejects
the calls with a `NetworkError`; check it with `isNetworkError`. See
[Errors](./reference/errors.md) for every error the client throws.

## Testing against a real server

A fake server only answers the way your test says it does. To check that
your code works with a real JMAP server, run one in your tests. This
library's own integration tests run [Stalwart](https://stalw.art/) in a
container with [Testcontainers](https://testcontainers.com/), which needs
Docker or another compatible container runtime.

A Vitest [global setup](https://vitest.dev/config/globalsetup) file starts
the container once for the whole run, creates a user, and shares its
credentials with the tests. Stalwart builds the URLs in its session from
`STALWART_PUBLIC_URL`, so the setup chooses the host port before the
container starts:

```ts
import {
  GenericContainer,
  getContainerRuntimeClient,
  RandomPortGenerator,
  Wait,
} from "testcontainers";
import type { TestProject } from "vitest/node";

declare module "vitest" {
  export interface ProvidedContext {
    jmap: {
      sessionUrl: string;
      username: string;
      password: string;
    };
  }
}

export default async function setup(project: TestProject) {
  const runtime = await getContainerRuntimeClient();
  const host = runtime.info.containerRuntime.host;
  const port =
    await new RandomPortGenerator().generatePort();
  const baseUrl = `http://${host}:${port}`;

  const container = await new GenericContainer(
    "stalwartlabs/stalwart:v1.1.0",
  )
    .withEnvironment({
      STALWART_RECOVERY_ADMIN: "admin:admin-password",
      STALWART_PUBLIC_URL: baseUrl,
    })
    .withExposedPorts({ container: 8080, host: port })
    .withWaitStrategy(
      Wait.forHttp("/healthz/live", 8080).forStatusCode(
        200,
      ),
    )
    .start();

  // Create a user with Stalwart's management API, as the admin
  const username = "test@example.test";
  const password = "test-password";

  project.provide("jmap", {
    sessionUrl: `${baseUrl}/.well-known/jmap`,
    username,
    password,
  });

  return () => container.stop();
}
```

Each test file then creates a client with `inject("jmap")`, and sends real
requests. The library's
[setup file](https://github.com/htunnicliff/json-meta-client/blob/main/src/__test__/integration/setup.ts)
shows the whole process, including creating the user through Stalwart's
management API with a [custom capability](./advanced/extending.md#defining-a-capability).
Since every test shares one account, give the objects each test creates
unique names.

## Type tests

When you define a [custom capability](./advanced/extending.md), type tests
can check that its method contracts give the argument and result types you
expect. Vitest's `expectTypeOf` compares types when the test files are type
checked, and `@ts-expect-error` checks that a call is rejected:

```ts
import { defineCapability } from "json-meta-client";
import { expectTypeOf } from "vitest";

interface Note {
  id: string;
  title: string;
}

const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note"],
}).withMethods<{
  Note: {
    get: {
      input: { accountId: string; ids: string[] };
      output: { list: Note[] };
    };
  };
}>();

test("Note/get takes IDs and returns notes", () => {
  const notesClient = new JsonMetaClient({
    sessionUrl,
    auth: "test-token",
    capabilities: [notes],
  });

  const getNotes = notesClient.api.Note.get({
    ids: ["N1"],
  });
  expectTypeOf<Awaited<typeof getNotes>>().toEqualTypeOf<{
    list: Note[];
  }>();

  // @ts-expect-error `ids` is required
  void notesClient.api.Note.get();
});
```

Put type tests in files that end in `.test-d.ts`, and turn on Vitest's
[type checking](https://vitest.dev/guide/testing-types) with
`typecheck: { enabled: true }`. Vitest type checks these files without
running them, so the method calls in them never reach a server.
