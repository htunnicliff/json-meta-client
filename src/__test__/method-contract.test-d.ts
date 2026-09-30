import type { Email, GetArguments, GetResponse } from "jmap-rfc-types";
import { describe, expectTypeOf, it } from "vitest";

import {
  defineCapability,
  type Apply,
  type AugmentMethod,
  type EffectiveMethodInput,
  type MethodArguments,
  type MethodContract,
} from "../capability.ts";
import { Client } from "../client.ts";
import type { JobResult } from "../internal/batch.ts";
import type { MethodCallOptions } from "../internal/method-calls.ts";
import type { MethodCall } from "../internal/method-calls.ts";
import { ref, type Ref } from "../ref.ts";

interface EchoContract {
  input: {
    accountId: string;
    nested: {
      name: string;
      coordinates: [number, number];
    };
  };
  output: this["input"];
}

interface AccountContract {
  input: { accountId: string };
  output: this["input"]["accountId"];
}

interface GetContract {
  input: GetArguments<Email>;
  output: GetResponse<Email, this["input"]>;
}

const example = defineCapability({
  urn: "test:method-contract",
  entities: ["Example"],
}).withMethods<{
  Example: {
    echo: EchoContract;
    account: AccountContract;
    get: GetContract;
    source: {
      input: {};
      output: {
        accountId: "account-from-reference";
        name: "referenced-name";
        coordinates: [1, 2];
        properties: ["id", "subject"];
      };
    };
  };
}>();

const client = new Client({
  sessionUrl: "https://example.test/.well-known/jmap",
  bearerToken: "token",
  capabilities: [example],
});

const source = client.api.Example.source({});

describe("method contract boundaries", () => {
  it("keeps declared input separate from caller arguments", () => {
    expectTypeOf<EchoContract["input"]["accountId"]>().toEqualTypeOf<string>();
    expectTypeOf<MethodArguments<EchoContract>["accountId"]>().toEqualTypeOf<
      string | Ref<string> | undefined
    >();
    expectTypeOf<{
      nested: { name: Ref<string>; coordinates: [Ref<number>, number] };
    }>().toExtend<MethodArguments<EchoContract>>();
    expectTypeOf<{
      nested: { name: string; coordinates: [Ref<string>, number] };
    }>().not.toExtend<MethodArguments<EchoContract>>();
  });

  it("resolves nested references and restores an omitted accountId once", () => {
    interface Args {
      nested: {
        name: Ref<"referenced-name">;
        coordinates: [Ref<1>, Ref<2>];
      };
    }
    interface Expected {
      accountId: string;
      nested: { name: "referenced-name"; coordinates: [1, 2] };
    }

    expectTypeOf<EffectiveMethodInput<EchoContract, Args>>().toEqualTypeOf<Expected>();
    expectTypeOf<Apply<EchoContract, EffectiveMethodInput<EchoContract, Args>>>().toEqualTypeOf<
      EchoContract["input"] & Expected
    >();
  });

  it("uses effective input for pending call metadata and awaited output", async () => {
    const pending = client.api.Example.echo({
      nested: {
        name: ref(source, "/name"),
        coordinates: ref(source, "/coordinates"),
      },
    });
    interface Input {
      nested: { name: "referenced-name"; coordinates: [1, 2] };
      accountId: string;
    }

    expectTypeOf(pending).toEqualTypeOf<
      JobResult<MethodCall<Input>, EchoContract["input"] & Input>
    >();
    expectTypeOf(pending.args.accountId).toEqualTypeOf<string>();
    expectTypeOf(pending.args.nested.coordinates).toEqualTypeOf<[1, 2]>();
    expectTypeOf<Awaited<typeof pending>>().toEqualTypeOf<EchoContract["input"] & Input>();
    expectTypeOf((await pending).nested.name).toEqualTypeOf<"referenced-name">();
  });

  it("evaluates account-dependent outputs when the account is injected", async () => {
    const pending = client.api.Example.account({});

    expectTypeOf(pending).toEqualTypeOf<JobResult<MethodCall<{ accountId: string }>, string>>();
    expectTypeOf(await pending).toEqualTypeOf<string>();
  });

  it("preserves a supplied account literal and an account reference", async () => {
    const explicit = client.api.Example.account({ accountId: "chosen-account" as const });
    const referenced = client.api.Example.account({ accountId: ref(source, "/accountId") });

    expectTypeOf(explicit.args.accountId).toEqualTypeOf<"chosen-account">();
    expectTypeOf(await explicit).toEqualTypeOf<"chosen-account">();
    expectTypeOf(referenced.args.accountId).toEqualTypeOf<"account-from-reference">();
    expectTypeOf(await referenced).toEqualTypeOf<"account-from-reference">();
  });

  it("narrows get responses from referenced property selections", async () => {
    const pending = client.api.Example.get({ properties: ref(source, "/properties") });

    expectTypeOf(pending.args.properties).toEqualTypeOf<["id", "subject"]>();
    expectTypeOf((await pending).list[0]!).toEqualTypeOf<Pick<Email, "id" | "subject">>();
  });

  it("leaves contracts without a required account unchanged", () => {
    interface OptionalAccountContract {
      input: { accountId?: string; value: string };
      output: this["input"];
    }
    interface NoAccountContract {
      input: { value: string };
      output: this["input"];
    }

    expectTypeOf<
      EffectiveMethodInput<OptionalAccountContract, { value: "value" }>
    >().toEqualTypeOf<{
      value: "value";
    }>();
    expectTypeOf<EffectiveMethodInput<NoAccountContract, { value: "value" }>>().toEqualTypeOf<{
      value: "value";
    }>();
    expectTypeOf<
      EffectiveMethodInput<OptionalAccountContract, { accountId?: string; value: string }>
    >().toEqualTypeOf<{ accountId: string; value: string }>();
  });

  it("retains untyped methods and their inferred pending arguments", () => {
    expectTypeOf<Parameters<AugmentMethod<MethodContract>>>().toEqualTypeOf<
      [args: {}, options?: MethodCallOptions]
    >();
    expectTypeOf<EffectiveMethodInput<MethodContract, { madeUp: Ref<"value"> }>>().toEqualTypeOf<{
      madeUp: "value";
    }>();
    expectTypeOf<Apply<MethodContract, { madeUp: "value" }>>().toBeUnknown();
  });
});
