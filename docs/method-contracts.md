# Method contracts and inference

A method contract describes the arguments in `input` and the result in `output`.
A fixed result needs only `{ input: Input; output: Output }`. When the result
changes with the arguments, declare an interface whose `output` uses
`this["input"]`. Built-in capabilities use the same format from `jmap-rfc-types`.

## Results that depend on arguments

This `get` contract narrows returned objects to the requested properties:

```ts
import type { GetArguments, GetResponse } from "jmap-rfc-types";
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

Calling it with `properties: ["name"]` produces a result whose `list` contains
only `name`. The caller can omit `accountId`; the client supplies the default
account. A typed result reference used for property selection gives the same
narrowing. Custom results can also depend on nested values supplied through
`ref()`.

## From caller arguments to a result type

The client derives types in this order:

| Type                                   | Role                                                                                                                                                        |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MethodContract`                       | Declares protocol input and output.                                                                                                                         |
| `MethodArguments<Contract>`            | Allows references in argument values, including nested objects and tuples, and makes a required `accountId` optional.                                       |
| `EffectiveMethodInput<Contract, Args>` | Unwraps references to their value types and restores the required account type when the caller omits it. Explicit account values keep their inferred types. |
| `Apply<Contract, Input>`               | Evaluates `output` against the effective input through `this["input"]`.                                                                                     |

The pending call is a promise of that evaluated output. Its `args` type describes
the effective input, including the selected values of references and the account
type supplied by the client.

This is a model for inference. At runtime, middleware supplies the account and
converts references to JMAP `#` arguments; the server resolves those references.
The pending metadata can therefore contain a reference where its type describes
the selected value. These types do not resolve references or validate responses.

## Other contract forms

An input without a required `accountId` keeps its declared requirements. An
untyped capability, defined without `.withMethods()`, accepts arbitrary method
names and infers pending argument types, with `unknown` results. Multiple
capabilities can contribute methods to one entity using the same contract format.
See [custom capabilities](custom-capabilities.md) for examples and conflict rules.

Existing custom `input`/`output` contracts and `Apply` remain compatible. Pending
calls now include the contract's required account type when the caller omits
`accountId`. Effective input is derived from the caller's argument type, so it
cannot be independently selected through a separate generic parameter.
