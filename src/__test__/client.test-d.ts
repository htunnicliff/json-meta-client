import type {
  Email,
  EmailAddress,
  GetArguments,
  GetResponse,
  ID,
  Mailbox,
  MailboxRole,
} from "jmap-rfc-types";
import { describe, expectTypeOf, it } from "vitest";

import { defineCapability } from "../capability.ts";
import { Client } from "../client.ts";
import type { BatchResult } from "../internal/batcher.ts";
import type { MethodCall } from "../internal/method-calls.ts";
import type { AllowRefs } from "../ref.ts";

const host = "https://example.test";
const bearerToken = "<opaque-token>";
const sessionUrl = `${host}/.well-known/jmap`;

const client = new Client({
  bearerToken,
  sessionUrl,
});

describe("Client", () => {
  describe("api", () => {
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

      it("still has built-ins", () => {
        expectTypeOf(client.api).toHaveProperty("Email");
        expectTypeOf(client.api).toHaveProperty("Core");
        expectTypeOf(client.api).toHaveProperty("Blob");
        expectTypeOf(client.api).toHaveProperty("VacationResponse");
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
  });
});
