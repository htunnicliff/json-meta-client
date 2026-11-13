// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

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
import type { MethodGet } from "../rfc-types/core/index.ts";
import type { ReadableEmail, EmailAddress, Mailbox } from "../rfc-types/mail/index.ts";
import type { Config } from "../types.ts";

const host = "https://example.test";
const token = "<opaque-token>";
const sessionUrl = `${host}/.well-known/jmap`;

const client = new JsonMetaClient({
  auth: token,
  sessionUrl,
  capabilities: [core, mail],
});

type DefaultEntities = DefaultCapabilities[number]["entities"][number];

describe(JsonMetaClient, () => {
  it("exposes built-in capability details on the session", async () => {
    const session = await client.session;
    const contactsSession = await new JsonMetaClient({
      auth: token,
      sessionUrl,
      capabilities: [contacts],
    }).session;

    expectTypeOf(session.capabilities[core.urn].maxCallsInRequest).toEqualTypeOf<number>();
    expectTypeOf(session.capabilities[core.urn].collationAlgorithms).toEqualTypeOf<string[]>();
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
        auth: token,
        sessionUrl,
        capabilities: ["core", "mail"],
      });
      expectTypeOf(namedClient.api).toEqualTypeOf(client.api);

      const allNamed = new JsonMetaClient({
        auth: token,
        sessionUrl,
        capabilities: [
          "core",
          "mail",
          "blob",
          "contacts",
          "mdn",
          "quota",
          "sharing",
          "sieve",
          "smime",
          "submission",
          "vacationResponse",
          "community:maskedEmail",
        ],
      });
      const allObjects = new JsonMetaClient({
        auth: token,
        sessionUrl,
        capabilities: Object.values(BUILT_IN_CAPABILITIES),
      });
      expectTypeOf(allNamed.api).toEqualTypeOf(allObjects.api);
      expectTypeOf<BuiltInCapabilityName>().toEqualTypeOf<keyof typeof BUILT_IN_CAPABILITIES>();
    });

    it("rejects a middleware option", () => {
      expectTypeOf<Config<readonly ["mail"]>>().not.toHaveProperty("middleware");
      const options: Config<readonly ["mail"]> = {
        auth: token,
        sessionUrl,
        capabilities: ["mail"],
        // @ts-expect-error - Middleware is internal, not a client option.
        middleware: [],
      };
      expectTypeOf(options).toEqualTypeOf<Config<readonly ["mail"]>>();
    });

    it("accepts readonly name arrays in separately declared options", async () => {
      const options: Config<readonly ["mail"]> = {
        auth: token,
        sessionUrl,
        capabilities: ["mail"],
      };
      const objectClient = new JsonMetaClient({
        auth: token,
        sessionUrl,
        capabilities: [mail],
      });
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
        auth: token,
        sessionUrl,
        // @ts-expect-error - Only exported built-in names are allowed
        capabilities: ["unknown"],
      });
      expectTypeOf(invalidClient).toBeObject();
    });

    it("has default capability methods when capabilities is empty", async () => {
      const emptyClient = new JsonMetaClient({
        auth: token,
        sessionUrl,
        capabilities: [],
      });

      expectTypeOf<keyof typeof emptyClient.api>().toEqualTypeOf<DefaultEntities>();

      expectTypeOf<DefaultEntities>().toEqualTypeOf<"Core" | "Blob" | "PushSubscription">();
      expectTypeOf(
        (await emptyClient.session).capabilities[core.urn].maxCallsInRequest,
      ).toEqualTypeOf<number>();
    });

    it("filters entity properties in Email/get requests", async () => {
      const response = await client.api.Email.get({
        ids: ["<pretend-email-id>"],
        properties: ["id", "to", "from"],
      });

      const email = response.list[0]!;

      type Expected = Pick<ReadableEmail, "id" | "to" | "from">;

      expectTypeOf(email).toMatchObjectType<Expected>();

      // Present
      expectTypeOf(email.id).toBeString();
      expectTypeOf(email.to).toEqualTypeOf<EmailAddress[] | null>();
      expectTypeOf(email.from).toEqualTypeOf<EmailAddress[] | null>();

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
      expectTypeOf(mailbox.role).toEqualTypeOf<string | null>();

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

      type Input = MethodGet.Input<Example>;
      type Output<A> = MethodGet.Output<Example, A>;
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
        auth: token,
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
          auth: token,
          capabilities: ["mail", example],
        });
        const objectClient = new JsonMetaClient({
          sessionUrl,
          auth: token,
          capabilities: [mail, example],
        });
        expectTypeOf(namedClient.api).toEqualTypeOf(objectClient.api);
      });

      it("respects accountId optionality", () => {
        type GivenArgs = GetContract["input"];
        expectTypeOf<GivenArgs["accountId"]>().toEqualTypeOf<string>();

        type ClientArgs = Parameters<typeof client.api.Example.get>[0];
        expectTypeOf<ClientArgs["accountId"]>().toEqualTypeOf<AllowRefs<string | undefined>>();
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
            accountId: string;
            state: string;
            list: readonly Example[];
            notFound: ReadonlyArray<string>;
          }> & {
            readonly $id: string;
            readonly $args: {
              ids: string[];
            };
            readonly $method: string;
          } & {
            resultRef: ResultRefFn<{
              accountId: string;
              state: string;
              list: readonly Example[];
              notFound: ReadonlyArray<string>;
            }>;
          }
        >();

        // Correct awaited result
        const result = await pending;
        expectTypeOf(result).toMatchObjectType<{
          accountId: string;
          state: string;
          list: readonly Example[];
          notFound: ReadonlyArray<string>;
        }>();

        // Awaited<T> pending also works
        expectTypeOf<Awaited<typeof pending>>().toMatchObjectType<{
          accountId: string;
          state: string;
          list: readonly Example[];
          notFound: ReadonlyArray<string>;
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
        auth: token,
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
        expectTypeOf(pending.resultRef("/stuff")).toEqualTypeOf<Ref>();
        expectTypeOf(pending.resultRef("/foo/*/bar/*")).toEqualTypeOf<Ref>();

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
          auth: token,
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

describe("undeclared argument properties", () => {
  it("accepts declared properties, patch paths, references and open-ended inputs", () => {
    const query = client.api.Mailbox.query({ filter: { role: "inbox" } });
    assertType(
      client.api.Mailbox.set({
        create: { box: { name: "Box", parentId: null } },
        update: { inbox: { name: "Inbox", isSubscribed: true } },
        destroy: query.resultRef("/ids"),
      }),
    );
    assertType(
      client.api.Email.set({
        update: { e1: { "keywords/$seen": true, "mailboxIds/inbox": null } },
      }),
    );
    assertType(client.api.Email.get({ properties: ["header:X-Spam:asText"] }));
    assertType(client.api.Core.echo({ anything: { nested: [1, "two"] } }));
  });

  it("rejects properties /set entries don't declare", () => {
    const created = { box: { name: "Box", title: "Box" } };
    const updated = { inbox: { name: "Inbox", color: "red" } };
    // @ts-expect-error Mailboxes have no `title`.
    assertType(client.api.Mailbox.set({ create: created }));
    // @ts-expect-error Mailboxes have no `color`.
    assertType(client.api.Mailbox.set({ update: updated }));
  });

  it("rejects undeclared properties at any depth", () => {
    assertType(
      client.api.Mailbox.query({
        filter: {
          operator: "AND",
          // @ts-expect-error `rol` is not a Mailbox filter condition.
          conditions: [{ role: "inbox" }, { rol: "trash" }],
        },
      }),
    );
    // @ts-expect-error `maximum` is not an Email/query argument.
    assertType(client.api.Email.query({ maximum: 10 }));
  });
});
