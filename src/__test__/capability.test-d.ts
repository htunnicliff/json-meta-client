import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  Apply,
  Capability,
  CapabilityMethods,
  ConfigurableCapability,
  InferMethodsFromCapability,
} from "../capability.ts";
import { defineCapability } from "../capability.ts";

const cap = defineCapability({
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Email", "Mailbox"],
});

type Entities = "Email" | "Mailbox";

describe("Capability", () => {
  it("produces a configurable capability with entity types", () => {
    type Expected = ConfigurableCapability<Entities>;
    expectTypeOf(cap).toEqualTypeOf<Expected>();
  });

  describe("withMethods", () => {
    it("produces a plain capability with entity and method types", () => {
      type Expected = Capability<Entities, CapabilityMethods<Entities>>;
      expectTypeOf(cap.withMethods()).toEqualTypeOf<Expected>();
    });

    it("enforces MethodContract adherence", () => {
      interface StillValid {
        input: Array<unknown>;
        output: this["input"];
      }

      // Valid
      assertType(
        cap.withMethods<{
          Email: {
            valid: {
              input: string;
              output: boolean;
            };
            alsoValid: {
              input: any;
              output: boolean;
            };
            stillValid: StillValid;
          };
          Mailbox: {
            // ...
          };
        }>(),
      );
    });
  });
});

describe("InferMethodsFromCapability", () => {
  it("infers any-typed methods from a configurable capability", () => {
    type Input = InferMethodsFromCapability<typeof cap>;
    type Expected = {
      Email: {
        [method: string]: {
          input: unknown;
          output: unknown;
        };
      };
      Mailbox: {
        [method: string]: {
          input: unknown;
          output: unknown;
        };
      };
    };
    expectTypeOf<Input>().toEqualTypeOf<Expected>();
  });

  it("infers correct methods from a configured capability", () => {
    type ContractInput = Record<string, unknown>;
    type ContractOutput<A extends ContractInput> = A & string;
    interface Contract {
      input: ContractInput;
      output: ContractOutput<this["input"]>;
    }

    type Methods = {
      Email: {
        get: {
          input: string;
          output: boolean;
        };
      };
      Mailbox: {
        another: Contract;
      };
    };

    const configured = cap.withMethods<Methods>();

    type Input = InferMethodsFromCapability<typeof configured>;

    expectTypeOf<Input>().toEqualTypeOf<Methods>();
  });
});

describe("Apply<Contract, Input>", () => {
  it("replaces initial input with given input", () => {
    type Input = { foo: boolean; bar: string[] };
    type Output<A> = { fizz: A[] };

    interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }

    expectTypeOf<
      Apply<
        Contract,
        {
          foo: true;
          bar: ["stuff"];
        }
      >
    >().toExtend<{
      fizz: {
        foo: true;
        bar: ["stuff"];
      }[];
    }>();
  });
});
