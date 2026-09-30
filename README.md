# json-meta-client

> [!WARNING]
> This library is alpha software.

## Overview

A [JMAP][jmap] client compatible with Node.js and the browser.

## Installation

```sh
pnpm add json-meta-client
```

## Usage

Create a client with the capabilities your JMAP server supports:

```ts
import { Client } from "json-meta-client";
import {
  mail,
  submission,
  contacts,
} from "json-meta-client/capabilities";

const client = new Client({
  bearerToken: "<token>",
  sessionUrl: "<session-url>",
  capabilities: [mail, submission, contacts], // `core` is always included
});
```

#### Issue a single JMAP request

```ts
const response = await client.api.Mailbox.query({
  filter: { role: "inbox" },
  limit: 1,
});

const [inboxId] = response.ids;
```

<details>
<summary>View JMAP request</summary>

```json
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail"
  ],
  "methodCalls": [
    [
      "Mailbox/query",
      {
        "accountId": "<primary-account-id>",
        "filter": { "role": "inbox" },
        "limit": 1
      },
      "<opaque id>"
    ]
  ]
}
```

</details>

#### Issue a batch of JMAP requests

This takes advantage of result references[^1]

```ts
import { ref } from "json-meta-client";

// Note the lack of `await` here:
const emailsQuery = client.api.Email.query({
  inMailbox: inboxId,
  limit: 10,
});

const emails = await client.api.Email.get({
  ids: ref(emailsQuery, "/ids"),
});
```

<details>
<summary>View JMAP request</summary>

```json
{
  "using": [
    "urn:ietf:params:jmap:core",
    "urn:ietf:params:jmap:mail"
  ],
  "methodCalls": [
    [
      "Email/query",
      {
        "accountId": "<primary-account-id>",
        "inMailbox": "<inbox-id>",
        "limit": 10
      },
      "<opaque id #1>"
    ],
    [
      "Email/get",
      {
        "accountId": "<primary-account-id>",
        "#ids": {
          "name": "Email/query",
          "resultOf": "<opaque id #1>",
          "path": "/ids"
        }
      },
      "<opaque id #2>"
    ]
  ]
}
```

</details>

## Custom capabilities

Define typed or untyped JMAP extensions with `defineCapability()` and `.withMethods()`. See the [custom capability guide](./docs/custom-capabilities.md) for a complete example, argument-dependent results, and shared entity behavior.

## Architecture

### Method contracts and inference

A method contract declares its protocol input in `input` and its result in
`output`. Use an interface and `this["input"]` when the result depends on the
arguments. The built-in capabilities use this same contract format from
`jmap-rfc-types`.

```ts
import type {
  GetArguments,
  GetResponse,
} from "jmap-rfc-types";
import { defineCapability } from "json-meta-client";

interface Example {
  id: string;
  name: string;
}

interface GetContract {
  input: GetArguments<Example>;
  output: GetResponse<Example, this["input"]>;
}

const example = defineCapability({
  urn: "test:example",
  entities: ["Example"],
}).withMethods<{ Example: { get: GetContract } }>();
```

The caller can omit `accountId` and supply `properties: ["name"]` to get a result
whose `list` contains only `name`. A reference to a typed property selection
produces the same narrowing. Custom methods can also depend on nested argument
values resolved from `ref()`.

All contract adaptation lives in `src/capability.ts`:

| Type                                   | Responsibility                                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MethodContract`                       | Declares the protocol input and output.                                                                                                                           |
| `MethodArguments<Contract>`            | Allows references within argument values, including nested objects and tuples, and makes a required `accountId` optional for the caller.                          |
| `EffectiveMethodInput<Contract, Args>` | Resolves references to their value types and restores a required `accountId` from the contract when omitted. Supplied account values retain their inferred types. |
| `Apply<Contract, Input>`               | Evaluates `output` against the specific effective input through the contract's `this["input"]`.                                                                   |
| `AugmentMethod<Contract>`              | Infers one `Args` type and returns a pending method call with its argument-dependent result.                                                                      |

The pending call is a `MethodCall<EffectiveMethodInput<Contract, Args>>`
intersected with a promise of the evaluated output. Its `args` type represents
effective inputs, including resolved reference values and an injected account
when the contract requires one. At runtime, reference values remain JMAP result
references and middleware converts their argument keys to `#` keys; their values
are resolved by the server. Account injection also happens in middleware. These
types describe inference and do not perform either runtime operation.

Contracts without a required `accountId` keep their declared input requirements.
A capability without `withMethods()` exposes arbitrary method names with inferred
pending argument types and `unknown` awaited results. Capabilities can contribute
different methods to the same entity without changing the contract format.

The `input`/`output` contract and `Apply` remain compatible with existing custom
capabilities. Compared with earlier releases, pending calls now include the
contract's required account type when `accountId` is omitted. `AugmentMethod`
accepts only the caller's argument generic; effective inputs are derived rather
than independently selectable.

### Proxies for Method Calls

> TODO: Discuss the use of a Proxy for determining method calls

### Deferred Request Batching

Calling a method queues it immediately and returns a promise.
The client automatically starts a batch at the next microtask
checkpoint. All calls queued before that flush starts are sent
in one JMAP request, in call order. You do not need to await a
call to make it eligible to be sent.

Calls issued synchronously share a request, including independent
calls. Awaiting their promises afterward does not change the
request they belong to:

```ts
const a = client.api.Email.query({ limit: 10 });
const b = client.api.Mailbox.query({ limit: 10 });
await a;
await b;
```

Awaiting a call before issuing the next one creates a boundary:

```ts
const a = await client.api.Email.query({ limit: 10 });
const b = await client.api.Email.get({ ids: a.ids });
```

These calls produce two requests. Yielding with
`await Promise.resolve()` after queuing a call also lets the
scheduled flush start before the following call is queued.
Microtasks run in the order they were queued: a call from a
microtask queued before the flush can join that batch; a call
from a microtask queued after the flush belongs to a new batch.
Calls from different microtasks therefore only share a request
when both run before the same flush.

A batch's membership is fixed when its flush starts, even if the
client is still loading the session or waiting for the server.
New calls form another batch, which can be sent and finish while
the earlier request is still in flight. Separate batches are not
serialized; await the earlier call if execution order matters.

Use `ref(pendingCall, "/ids")` to express a dependency without
awaiting the source call, as in the example above. The client
sends the reference as a JMAP `#ids` argument; the server resolves
it. Several calls may reference the same pending call. Queue the
source first and its dependents before the same flush. References
are local to one request: `ref()` does not move calls between
batches or validate that they share a batch. After awaiting a
source, pass its returned values to the next request instead.

Each call's promise settles using its own response ID, even when
responses arrive in a different order. A method-level error rejects
that call and leaves successful calls in the batch resolved.
Dependent calls settle according to their own server responses.
An HTTP or transport failure rejects all calls in the affected
batch with the same error. A missing method response rejects the
corresponding call. A failure while processing the batch rejects
any promises still pending; promises already settled keep their
results. Processing failures are handled for both synchronous
throws and asynchronous rejections. Later batches can still run.

The current API has no method-call cancellation or `AbortSignal`,
manual flush operation, or automatic batch splitting. It does not
enforce server-advertised request-size, method-call, or concurrency
limits. An oversized batch is sent as one request and any server
failure is propagated normally. Callers that need to control these
limits should issue smaller groups and await each group before
issuing the next one. These features are outside the current
batching contract and may be added in a future release.

[^1]: [RFC 8620 § 3.7 - References to Previous Method Results](https://jmap.io/spec/rfc8620/#section-3.7)

[jmap]: https://jmap.io/
[rfc8620]: https://jmap.io/spec/rfc8620/
[rfc8621]: https://jmap.io/spec/rfc8621/
[rfc8887]: https://jmap.io/spec/rfc8887/
[rfc9007]: https://jmap.io/spec/rfc9007/
[rfc9219]: https://jmap.io/spec/rfc9219/
[rfc9404]: https://jmap.io/spec/rfc9404/
[rfc9425]: https://jmap.io/spec/rfc9425/
[rfc9610]: https://jmap.io/spec/rfc9610/
[rfc9661]: https://jmap.io/spec/rfc9661/
[rfc9670]: https://jmap.io/spec/rfc9670/
[rfc9749]: https://jmap.io/spec/rfc9749/
[batcher]: ./src/internal/batch.ts
