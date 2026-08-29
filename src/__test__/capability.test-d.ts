import { assertType, describe, expectTypeOf, it } from "vitest";

import {
  Capability,
  CapabilityMethods,
  ConfigurableCapability,
  defineCapability,
  InferMethodsFromCapability,
} from "../capability";

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

    it("enforces only one parameter in method arguments", () => {
      // Valid
      assertType(
        cap.withMethods<{
          Email: {
            valid: (arg: string) => boolean;
            alsoValid: (arg: any) => boolean;
            stillValid: <A extends Array<unknown>>(arg: A) => A;
          };
          Mailbox: {
            moreValid: <A>(arg: A) => A;
          };
        }>(),
      );

      // Invalid
      assertType(
        // @ts-expect-error asserting invalid
        cap.withMethods<{
          Email: {
            notValid: (arg: string, somethingElse: boolean) => void;
          };
          Mailbox: {};
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
        [method: string]: (arg: any) => any;
      };
      Mailbox: {
        [method: string]: (arg: any) => any;
      };
    };
    expectTypeOf<Input>().toEqualTypeOf<Expected>();
  });

  it("infers correct methods from a configured capability", () => {
    type Methods = {
      Email: {
        get: (something: string) => boolean;
      };
      Mailbox: {
        another: <A extends Record<string, unknown>>(args: A) => A & string;
      };
    };

    const configured = cap.withMethods<Methods>();
    type Input = InferMethodsFromCapability<typeof configured>;

    expectTypeOf<Input>().toEqualTypeOf<Methods>();
  });
});
