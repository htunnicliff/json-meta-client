// oxlint-disable typescript/no-unnecessary-type-arguments
import type {
  Email,
  EmailAddress,
  GetArguments,
  GetResponse,
  ID,
  Mailbox,
  MailboxRole,
} from "jmap-rfc-types";
import { assertType, describe, expectTypeOf, it } from "vitest";

import { core, mail } from "../capabilities/index.ts";
import { defineCapability, type AugmentMethod, type MethodContract } from "../capability.ts";
import { Client } from "../client.ts";
import type { BatchResult } from "../internal/batcher.ts";
import type { MethodCall } from "../internal/method-calls.ts";
import type { AllowRefsInArgs } from "../internal/types.ts";
import { ref, type AllowRefs, type Ref } from "../ref.ts";

const host = "https://example.test";
const bearerToken = "<opaque-token>";
const sessionUrl = `${host}/.well-known/jmap`;

const client = new Client({
  bearerToken,
  sessionUrl,
  capabilities: [core, mail],
});

// @ts-expect-error - capabilities must be provided
const invalidClient = new Client({ bearerToken, sessionUrl });
expectTypeOf(invalidClient).toBeObject();

describe("Client", () => {
  describe("api", () => {
    it("exposes selected built-ins and excludes unselected ones", () => {
      expectTypeOf(client.api).toHaveProperty("Email");
      expectTypeOf(client.api).toHaveProperty("Core");
      expectTypeOf<
        "VacationResponse" extends keyof typeof client.api ? true : false
      >().toEqualTypeOf<false>();
      expectTypeOf<
        "ContactCard" extends keyof typeof client.api ? true : false
      >().toEqualTypeOf<false>();
    });

    it("has no entity methods when capabilities is empty", () => {
      const emptyClient = new Client({ bearerToken, sessionUrl, capabilities: [] });
      expectTypeOf<keyof typeof emptyClient.api>().toEqualTypeOf<never>();
    });

    it("filters entity properties in Email/get requests", async () => {
      const response = await client.api.Email.get({
        ids: ["<pretend-email-id>"],
        properties: ["id", "to", "from"],
      });

      const email = response.list[0]!;

      type Expected = Pick<Email, "id" | "to" | "from">;

      expectTypeOf(email).toMatchObjectType<Expected>();

      // Present
      expectTypeOf(email.id).toBeString();
      expectTypeOf(email.to).toEqualTypeOf<EmailAddress[] | undefined>();
      expectTypeOf(email.from).toEqualTypeOf<EmailAddress[] | undefined>();

      // Not present
      expectTypeOf(email).not.toHaveProperty("keywords");
      expectTypeOf(email).not.toHaveProperty("blobId");
      expectTypeOf(email).not.toHaveProperty("headers");
      expectTypeOf(email).not.toHaveProperty("keywords");
    });

    it("filters entity properties in Mailbox/get requests", async () => {
      const response = await client.api.Mailbox.get({
        ids: ["<pretend-mailbox-id>"],
        properties: ["id", "name", "role", "totalEmails"],
      });

      const mailbox = response.list[0]!;

      type Expected = Pick<Mailbox, "id" | "name" | "role" | "totalEmails">;

      expectTypeOf(mailbox).toMatchObjectType<Expected>();

      // Present
      expectTypeOf(mailbox.id).toBeString();
      expectTypeOf(mailbox.name).toBeString();
      expectTypeOf(mailbox.role).toEqualTypeOf<MailboxRole | null>();

      // Not present
      expectTypeOf(mailbox).not.toHaveProperty("totalThreads");
      expectTypeOf(mailbox).not.toHaveProperty("sortOrder");
      expectTypeOf(mailbox).not.toHaveProperty("myRights");
      expectTypeOf(mailbox).not.toHaveProperty("isSubscribed");
    });

    describe("when using a custom capability", () => {
      interface Example {
        some: string;
        things: string[];
        nested: {
          properties: [number, number];
        };
      }

      type Input = GetArguments<Example>;
      type Output<A> = GetResponse<Example, A>;
      interface GetContract {
        input: Input;
        output: Output<this["input"]>;
      }

      const example = defineCapability({
        urn: "test:example",
        entities: ["Example"],
      }).withMethods<{
        Example: {
          get: GetContract;
        };
      }>();

      const client = new Client({
        sessionUrl,
        bearerToken,
        capabilities: [example],
      });

      it("only exposes the selected capability", () => {
        expectTypeOf(client.api).toHaveProperty("Example");
        expectTypeOf<keyof typeof client.api>().toEqualTypeOf<"Example">();
      });

      it("respects accountId optionality", () => {
        type GivenArgs = GetContract["input"];
        expectTypeOf<GivenArgs["accountId"]>().toEqualTypeOf<ID>();

        type ClientArgs = Parameters<typeof client.api.Example.get>[0];
        expectTypeOf<ClientArgs["accountId"]>().toEqualTypeOf<AllowRefs<ID | undefined>>();
      });

      it("respects generics (`properties` for Get requests, in this case)", async () => {
        const filtered = client.api.Example.get({
          ids: ["<some-id>"],
          properties: ["some", "things"],
        });
        const unfiltered = client.api.Example.get({
          ids: ["<some-id>"],
        });

        const [filteredResult, unfilteredResult] = await Promise.all([filtered, unfiltered]);

        // Both are readonly arrays
        expectTypeOf(filteredResult.list).toExtend<ReadonlyArray<unknown>>();
        expectTypeOf(unfilteredResult.list).toExtend<ReadonlyArray<unknown>>();

        // Filtered has specified properties
        expectTypeOf(filteredResult.list.at(0)!).toEqualTypeOf<Pick<Example, "some" | "things">>();

        // Unfiltered has all properties
        expectTypeOf(unfilteredResult.list.at(0)!).toEqualTypeOf<Example>();
      });

      it("uses BatchResult types appropriately", async () => {
        const pending = client.api.Example.get({
          ids: ["<some-id>"],
        });

        // Correct batch result type
        expectTypeOf(pending).toEqualTypeOf<
          BatchResult<
            MethodCall<{ ids: string[] }>,
            {
              accountId: ID;
              state: string;
              list: readonly Example[];
              notFound: ReadonlyArray<ID>;
            }
          >
        >();

        // Correct awaited result
        const result = await pending;
        expectTypeOf(result).toMatchObjectType<{
          accountId: ID;
          state: string;
          list: readonly Example[];
          notFound: ReadonlyArray<ID>;
        }>();

        // Awaited<T> pending also works
        expectTypeOf<Awaited<typeof pending>>().toMatchObjectType<{
          accountId: ID;
          state: string;
          list: readonly Example[];
          notFound: ReadonlyArray<ID>;
        }>();
      });
    });

    describe("when using a custom capability lacking withMethod types", () => {
      const untyped = defineCapability({
        urn: "some:special:urn",
        entities: ["Something", "AnotherThing"],
      });

      const client = new Client({
        sessionUrl,
        bearerToken,
        capabilities: [untyped],
      });

      it("only exposes the selected entities", () => {
        expectTypeOf<keyof typeof client.api>().toEqualTypeOf<"Something" | "AnotherThing">();
      });

      it("allows any string for entity methods", async () => {
        // Has entity types
        expectTypeOf(client.api).toHaveProperty("Something");
        expectTypeOf(client.api).toHaveProperty("AnotherThing");

        // Allows any string for method calls
        expectTypeOf(client.api.Something).toEqualTypeOf<{
          [x: string]: AugmentMethod<MethodContract>;
        }>();
        expectTypeOf(client.api.AnotherThing).toEqualTypeOf<{
          [x: string]: AugmentMethod<MethodContract>;
        }>();
      });

      it("has `Augmented<MethodContract>` for all arbitrary methods", async () => {
        // The `undefined` union value is only true when `noUncheckedIndexedAccess` is enabled
        expectTypeOf(client.api.Something.someRandomMethod).toEqualTypeOf<
          AugmentMethod<MethodContract> | undefined
        >();
        expectTypeOf(client.api.AnotherThing.anotherMethod).toEqualTypeOf<
          AugmentMethod<MethodContract> | undefined
        >();

        // Args are unknown
        type Args = Parameters<NonNullable<typeof client.api.Something.aRandomMethod>>;
        expectTypeOf<Args>().toEqualTypeOf<[args: AllowRefsInArgs<unknown>]>();
        expectTypeOf<Args>().toExtend<[object]>();
        expectTypeOf<Args>().toExtend<[{}]>();

        // Uses unknown BatchResult type
        const pending = client.api.Something.aRandomMethod!({
          madeUp: "argument",
          stuff: ["<foo-id>"],
        });
        expectTypeOf(pending).toEqualTypeOf<
          BatchResult<MethodCall<{ madeUp: string; stuff: string[] }>, unknown>
        >();

        // Supports refs with arbitrary pointers
        expectTypeOf(ref(pending, "/stuff")).toEqualTypeOf<Ref<unknown>>();
        expectTypeOf(ref(pending, "/foo/*/bar/*")).toEqualTypeOf<Ref<unknown>>();

        // @ts-expect-error - "/${string}" is required
        assertType(ref(pending, "invalid"));

        // Result is unknown
        const result = await pending;
        expectTypeOf(result).toBeUnknown();
      });
    });
  });
});
