import type {
  Email,
  EmailAddress,
  GetArguments,
  GetResponse,
  Mailbox,
  MailboxRole,
} from "jmap-rfc-types";
import { describe, expectTypeOf, it } from "vitest";

import { defineCapability } from "../capability.ts";
import { Client } from "../client.ts";

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

      expectTypeOf(email).toExtend<Expected>();

      // Present
      expectTypeOf(email.id).toBeString();
      expectTypeOf(email.to).toEqualTypeOf<EmailAddress[]>();
      expectTypeOf(email.from).toEqualTypeOf<EmailAddress[]>();

      // Not present
      expectTypeOf(email).not.toHaveProperty("keywords");
      expectTypeOf(email).not.toHaveProperty("blobId");
      expectTypeOf(email).not.toHaveProperty("headers");
      expectTypeOf(email).not.toHaveProperty("keywords");
    });

    it("filters entity properties in Mailbox/get requests", async () => {
      const response = await client.api.Mailbox.get({
        ids: ["<pretend-mailbox-id>"],
        properties: ["id", "name", "role"],
      });

      const mailbox = response.list[0]!;

      type Expected = Pick<Mailbox, "id" | "name" | "role">;

      expectTypeOf(mailbox).toEqualTypeOf<Expected>();

      // Present
      expectTypeOf(mailbox.id).toBeString();
      expectTypeOf(mailbox.name).toBeString();
      expectTypeOf(mailbox.role).toExtend<MailboxRole | null>();

      // Not present
      expectTypeOf(mailbox).not.toHaveProperty("totalThreads");
      expectTypeOf(mailbox).not.toHaveProperty("sortOrder");
      expectTypeOf(mailbox).not.toHaveProperty("myRights");
      expectTypeOf(mailbox).not.toHaveProperty("isSubscribed");
    });

    describe("when using a custom capability", () => {
      type Example = {
        id: string;
        stuff: string;
        here: boolean;
      };

      type ContractInput = GetArguments<Example>;
      type ContractOutput<A> = GetResponse<Example, A>;

      interface Contract {
        input: ContractInput;
        output: ContractOutput<this["input"]>;
      }

      const example = defineCapability({
        urn: "test:example",
        entities: ["Example"],
      }).withMethods<{
        Example: {
          get: Contract;
        };
      }>();

      it("filters entity properties in get requests", async () => {
        const client = new Client({
          sessionUrl,
          bearerToken,
          capabilities: [example],
        });

        const response = await client.api.Example.get({
          ids: ["<pretend-example-id>"],
          properties: ["stuff", "here"],
        });

        const item = response.list[0]!;

        type Expected = Pick<Example, "stuff" | "here">;

        expectTypeOf(item).toMatchObjectType<Expected>();

        // Present
        expectTypeOf(item.stuff).toBeString();
        expectTypeOf(item.here).toBeBoolean();

        // Not present
        expectTypeOf(item).not.toHaveProperty("id");
      });
    });
  });
});
