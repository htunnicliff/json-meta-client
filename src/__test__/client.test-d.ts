import {
  Email,
  EmailAddress,
  GetArguments,
  GetResponse,
  Mailbox,
  MailboxRole,
} from "jmap-rfc-types";
import { describe, expectTypeOf, it } from "vitest";

import { defineCapability } from "../capability";
import { Client } from "../client";

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

      const [email] = response.list;

      type Expected = Pick<Email, "id" | "to" | "from">;

      expectTypeOf(email).toMatchObjectType<Expected>();

      // Present
      expectTypeOf(email.id).toBeString();
      expectTypeOf(email.to![0]).toMatchObjectType<EmailAddress>();
      expectTypeOf(email.from![0]).toMatchObjectType<EmailAddress>();

      // Not present
      expectTypeOf(email.keywords).toBeNever();
      expectTypeOf(email.blobId).toBeNever();
      expectTypeOf(email.headers).toBeNever();
      expectTypeOf(email.keywords).toBeNever();
    });

    it("filters entity properties in Mailbox/get requests", async () => {
      const response = await client.api.Mailbox.get({
        ids: ["<pretend-mailbox-id>"],
        properties: ["id", "name", "role"],
      });

      const [mailbox] = response.list;

      type Expected = Pick<Mailbox, "id" | "name" | "role">;

      expectTypeOf(mailbox).toMatchObjectType<Expected>();

      // Present
      expectTypeOf(mailbox.id).toBeString();
      expectTypeOf(mailbox.name).toBeString();
      expectTypeOf(mailbox.role!).toExtend<MailboxRole>();

      // Not present
      expectTypeOf(mailbox.totalThreads).toBeNever();
      expectTypeOf(mailbox.sortOrder).toBeNever();
      expectTypeOf(mailbox.myRights).toBeNever();
      expectTypeOf(mailbox.isSubscribed).toBeNever();
    });

    describe("when using a custom capability", () => {
      type Example = {
        id: string;
        stuff: string;
        here: boolean;
      };

      const example = defineCapability({
        urn: "test:example",
        entities: ["Example"],
      }).withMethods<{
        Example: {
          get: <const A extends GetArguments<Example>>(args: A) => GetResponse<Example, A>;
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

        const [item] = response.list;

        type Expected = Pick<Example, "stuff" | "here">;

        expectTypeOf(item).toMatchObjectType<Expected>();

        // Present
        expectTypeOf(item.stuff).toBeString();
        expectTypeOf(item.here).toBeBoolean();

        // Not present
        expectTypeOf(item.id).toBeNever();
      });
    });
  });
});
