# Method contracts and inference

A method contract declares its protocol input in `input` and its result in
`output`. Use an interface and `this["input"]` when the result depends on the
arguments. The built-in capabilities use this same contract format from
`jmap-rfc-types`.

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

The caller can omit `accountId` and supply `properties: ["name"]` to get a result
whose `list` contains only `name`. A reference to a typed property selection
produces the same narrowing. Custom methods can also depend on nested argument
values resolved from `ref()`.

The client derives argument and result types through these steps:

| Type                                   | Responsibility                                                                                                                                                    |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MethodContract`                       | Declares the protocol input and output.                                                                                                                           |
| `MethodArguments<Contract>`            | Allows references within argument values, including nested objects and tuples, and makes a required `accountId` optional for the caller.                          |
| `EffectiveMethodInput<Contract, Args>` | Resolves references to their value types and restores a required `accountId` from the contract when omitted. Supplied account values retain their inferred types. |
| `Apply<Contract, Input>`               | Evaluates `output` against the specific effective input through the contract's `this["input"]`.                                                                   |

The pending call carries effective argument metadata and is a promise
of the evaluated output. Its `args` type represents
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
contract's required account type when `accountId` is omitted. Effective inputs are derived
from the caller's arguments rather than independently selectable.

See [custom capability authoring](custom-capabilities.md) for a complete example.
