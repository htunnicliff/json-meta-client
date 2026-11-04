/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

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

import { BUILT_IN_CAPABILITIES } from "../built-ins.ts";
import type { BuiltInCapabilityName, DefaultCapabilities } from "../built-ins.ts";
import { contacts, core, mail } from "../capabilities/index.ts";
import type { MethodContract } from "../capability.ts";
import { defineCapability } from "../capability.ts";
import { JsonMetaClient } from "../client.ts";
import type { Ref, ResultRefFn } from "../internal/ref.ts";
import type { AugmentedOptions } from "../internal/types.ts";
import type { AllowRefs, AugmentMethod, MethodArguments } from "../internal/types.ts";
import type { Config } from "../types.ts";

const host = "https://example.test";
const bearerToken = "<opaque-token>";
const sessionUrl = `${host}/.well-known/jmap`;

const client = new JsonMetaClient({
  bearerToken,
  sessionUrl,
  capabilities: [core, mail],
});

type DefaultEntities = DefaultCapabilities[number]["entities"][number];

describe(JsonMetaClient, () => {
  it("exposes built-in capability details on the session", async () => {
    const session = await client.session;
    const contactsSession = await new JsonMetaClient({
      bearerToken,
      sessionUrl,
      capabilities: [contacts],
    }).session;

    expectTypeOf(session.capabilities[core.urn]?.maxCallsInRequest).toEqualTypeOf<
      number | undefined
    >();
    expectTypeOf(session.capabilities[core.urn]?.collationAlgorithms).toEqualTypeOf<
      string[] | undefined
    >();
    expectTypeOf(
      session.accounts["example-account"]!.accountCapabilities[mail.urn]
        ?.maxSizeAttachmentsPerEmail,
    ).toEqualTypeOf<number | undefined>();
    expectTypeOf(
      session.accounts["example-account"]!.accountCapabilities[mail.urn]?.maxMailboxDepth,
    ).toEqualTypeOf<number | null | undefined>();
    expectTypeOf(
      contactsSession.accounts["example-account"]!.accountCapabilities[contacts.urn]
        ?.mayCreateAddressBook,
    ).toEqualTypeOf<boolean | undefined>();
  });

  describe("isolated", () => {
    it("provides the client's API and a cancellation function", () => {
      client.isolated((api, cancel) => {
        expectTypeOf(api).toEqualTypeOf(client.api);
        expectTypeOf(cancel).toEqualTypeOf<() => void>();
      });
    });

    it("infers synchronous and asynchronous callback results", () => {
      const synchronous = client.isolated(() => ({ value: "result" }));
      const asynchronous = client.isolated(async () => ({ value: "result" }));

      expectTypeOf(synchronous).toEqualTypeOf<{ value: string }>();
      expectTypeOf(asynchronous).toEqualTypeOf<Promise<{ value: string }>>();
    });
  });

  describe("api", () => {
    it("infers the same methods from built-in names and objects", () => {
      const namedClient = new JsonMetaClient({
        bearerToken,
        sessionUrl,
        capabilities: ["core", "mail"],
      });
      expectTypeOf(namedClient.api).toEqualTypeOf(client.api);

      const allNamed = new JsonMetaClient({
        bearerToken,
        sessionUrl,
        capabilities: [
          "core",
          "mail",
          "blob",
          "contacts",
          "sieve",
          "submission",
          "vacationResponse",
          "community:maskedEmail",
        ],
      });
      const allObjects = new JsonMetaClient({
        bearerToken,
        sessionUrl,
        capabilities: Object.values(BUILT_IN_CAPABILITIES),
      });
      expectTypeOf(allNamed.api).toEqualTypeOf(allObjects.api);
      expectTypeOf<BuiltInCapabilityName>().toEqualTypeOf<keyof typeof BUILT_IN_CAPABILITIES>();
    });

    it("accepts readonly name arrays in separately declared options", async () => {
      const options: Config<readonly ["mail"]> = {
        bearerToken,
        sessionUrl,
        capabilities: ["mail"],
      };
      const objectClient = new JsonMetaClient({ bearerToken, sessionUrl, capabilities: [mail] });
      expectTypeOf(new JsonMetaClient(options).api).toEqualTypeOf(objectClient.api);
      expectTypeOf(
        (await new JsonMetaClient(options).session).accounts["example-account"]!
          .accountCapabilities[mail.urn],
      ).toEqualTypeOf(
        (await objectClient.session).accounts["example-account"]!.accountCapabilities[mail.urn],
      );
    });

    it("rejects names that are not built-in exports", () => {
      const invalidClient = new JsonMetaClient({
        bearerToken,
        sessionUrl,
        // @ts-expect-error - Only exported built-in names are allowed
        capabilities: ["unknown"],
      });
      expectTypeOf(invalidClient).toBeObject();
    });

    it("has default capability methods when capabilities is empty", async () => {
      const emptyClient = new JsonMetaClient({
        bearerToken,
        sessionUrl,
        capabilities: [],
      });

      expectTypeOf<keyof typeof emptyClient.api>().toEqualTypeOf<DefaultEntities>();

      expectTypeOf<DefaultEntities>().toEqualTypeOf<"Core" | "Blob" | "PushSubscription">();
      expectTypeOf(
        (await emptyClient.session).capabilities[core.urn]?.maxCallsInRequest,
      ).toEqualTypeOf<number | undefined>();
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

      interface ExampleAccountCapabilities {
        mayCreateExample: boolean;
      }

      interface ExampleSessionCapabilities {
        maxExamples: number;
      }

      const example = defineCapability({
        urn: "test:example",
        entities: ["Example"],
      }).withMethods<
        {
          Example: {
            get: GetContract;
          };
        },
        ExampleAccountCapabilities,
        ExampleSessionCapabilities
      >();

      const client = new JsonMetaClient({
        sessionUrl,
        bearerToken,
        capabilities: [example],
      });

      it("exposes the custom capability's entities", () => {
        expectTypeOf(client.api).toHaveProperty("Example");
        expectTypeOf<keyof typeof client.api>().toEqualTypeOf<"Example" | DefaultEntities>();
      });

      it("exposes capability details on the session", async () => {
        const session = await client.session;
        const refreshedSession = await client.refreshSession();

        expectTypeOf(session.capabilities[example.urn]).toEqualTypeOf<
          ExampleSessionCapabilities | undefined
        >();
        expectTypeOf(
          session.accounts["example-account"]!.accountCapabilities[example.urn],
        ).toEqualTypeOf<ExampleAccountCapabilities | undefined>();
        expectTypeOf(refreshedSession).toEqualTypeOf(session);
      });

      it("preserves custom capability contracts in isolated callbacks", () => {
        const result = client.isolated((api) => {
          expectTypeOf(api).toEqualTypeOf(client.api);
          return api.Example.get({ ids: ["example"], properties: ["some"] });
        });

        expectTypeOf<Awaited<typeof result>["list"][number]>().toEqualTypeOf<
          Pick<Example, "some">
        >();
      });

      it("preserves built-in and custom contracts when mixing names and objects", () => {
        const namedClient = new JsonMetaClient({
          sessionUrl,
          bearerToken,
          capabilities: ["mail", example],
        });
        const objectClient = new JsonMetaClient({
          sessionUrl,
          bearerToken,
          capabilities: [mail, example],
        });
        expectTypeOf(namedClient.api).toEqualTypeOf(objectClient.api);
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
        expectTypeOf(filteredResult.list.at(0)).toEqualTypeOf<
          Pick<Example, "some" | "things"> | undefined
        >();

        // Unfiltered has all properties
        expectTypeOf(unfilteredResult.list.at(0)).toEqualTypeOf<Example | undefined>();
      });

      it("uses BatchResult types appropriately", async () => {
        const pending = client.api.Example.get({
          ids: ["<some-id>"],
        });

        // Correct batch result type
        expectTypeOf(pending).toEqualTypeOf<
          Promise<{
            accountId: ID;
            state: string;
            list: readonly Example[];
            notFound: ReadonlyArray<ID>;
          }> & {
            readonly $id: string;
            readonly $args: {
              ids: string[];
            };
            readonly $method: string;
          } & {
            resultRef: ResultRefFn<{
              accountId: ID;
              state: string;
              list: readonly Example[];
              notFound: ReadonlyArray<ID>;
            }>;
          }
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

      const client = new JsonMetaClient({
        sessionUrl,
        bearerToken,
        capabilities: [untyped],
      });

      it("only exposes the selected entities", () => {
        expectTypeOf<keyof typeof client.api>().toEqualTypeOf<
          "Something" | "AnotherThing" | DefaultEntities
        >();
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
        type Args = Parameters<NonNullable<typeof client.api.Something.aRandomMethod>>[0];
        // oxlint-disable-next-line typescript/no-generated-empty-object-type
        expectTypeOf<Args>().toEqualTypeOf<MethodArguments<MethodContract>>();
        expectTypeOf<Args>().toExtend<object>();
        expectTypeOf<Args>().toExtend<{}>();

        // Options are AugmentedOptions or undefined
        type Options = Parameters<NonNullable<typeof client.api.Something.aRandomMethod>>[1];
        expectTypeOf<Options>().toEqualTypeOf<AugmentedOptions | undefined>();

        // Uses unknown BatchResult type
        const pending = client.api.Something.aRandomMethod!({
          madeUp: "argument",
          stuff: ["<foo-id>"],
        });
        expectTypeOf(pending).toExtend<Promise<unknown>>();

        // Supports refs with arbitrary pointers
        expectTypeOf(pending.resultRef("/stuff")).toEqualTypeOf<Ref<unknown>>();
        expectTypeOf(pending.resultRef("/foo/*/bar/*")).toEqualTypeOf<Ref<unknown>>();

        // @ts-expect-error - "/${string}" is required
        assertType(pending.resultRef("invalid"));

        // Result is unknown
        const result = await pending;
        expectTypeOf(result).toBeUnknown();
      });
    });

    describe("when using separate capabilities that share entities", () => {
      const theater = defineCapability({
        urn: "test:popcorn",
        entities: ["Popcorn", "HotDog"],
      }).withMethods<{
        Popcorn: {};
        HotDog: {
          eat: {
            input: {
              hunger: number;
            };
            output: {
              id: string;
            };
          };
        };
      }>();

      const picnic = defineCapability({
        urn: "test:picnic",
        entities: ["Burger", "Salad", "HotDog"],
      }).withMethods<{
        Burger: {};
        Salad: {};
        HotDog: {
          cook: {
            input: {
              buns: "toasted" | "burnt";
            };
            output: {
              char: number;
            };
          };
        };
      }>();

      it("appropriately intersects entity method types", async () => {
        const client = new JsonMetaClient({
          bearerToken,
          sessionUrl,
          capabilities: [theater, picnic],
        });

        // From `theater`
        expectTypeOf(client.api.HotDog).toHaveProperty("eat");

        // From `picnic`
        expectTypeOf(client.api.HotDog).toHaveProperty("cook");
      });
    });
  });
});
