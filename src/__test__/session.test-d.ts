import { describe, expectTypeOf, it } from "vitest";

import { JsonMetaClient, defineCapability } from "../index.ts";
import type {
  CapabilityOption,
  ClientApi,
  ClientSession,
  Config,
  InferMethodsFromCapability,
  ResolveCapability,
} from "../index.ts";
import { makeSession } from "./fixtures.ts";

const vendorMail = defineCapability({
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Email"],
}).withMethods<
  {
    Email: {
      vendorArchive: {
        input: { ids: string[] };
        output: { archived: string[] };
      };
    };
  },
  { mayUseVendorArchive: boolean },
  { vendorVersion: string }
>();

const options = {
  bearerToken: "token",
  sessionUrl: "https://example.test/jmap",
  capabilities: ["mail", vendorMail],
} as const satisfies Config<readonly CapabilityOption[]>;

const client = new JsonMetaClient(options);

describe("session capability details", () => {
  it("exports client types through the public entry point", () => {
    expectTypeOf<Awaited<typeof client.session>>().toEqualTypeOf<
      ClientSession<typeof options.capabilities>
    >();
    expectTypeOf(client.api).toExtend<ClientApi<typeof options.capabilities>>();
    expectTypeOf<InferMethodsFromCapability<ResolveCapability<"mail">>>().toHaveProperty("Email");
  });

  it("allows a shared account to support contacts without supporting mail", () => {
    const session = {
      ...makeSession(),
      capabilities: {},
      accounts: {
        shared: {
          name: "Shared contacts",
          isPersonal: false,
          isReadOnly: true,
          accountCapabilities: {
            "urn:ietf:params:jmap:contacts": { mayCreateAddressBook: false },
          },
        },
      },
    } satisfies ClientSession<readonly ["mail", "contacts"]>;

    expectTypeOf(session.accounts.shared.accountCapabilities).not.toHaveProperty(vendorMail.urn);
  });

  it("requires presence checks and preserves standard and vendor details after narrowing", async () => {
    const session = await client.session;
    const account = session.accounts["shared"]!;
    const accountDetails = account.accountCapabilities[vendorMail.urn];
    const sessionDetails = session.capabilities[vendorMail.urn];

    expectTypeOf(accountDetails).toExtend<{ mayUseVendorArchive: boolean } | undefined>();
    expectTypeOf(sessionDetails).toEqualTypeOf<{ vendorVersion: string } | undefined>();

    // @ts-expect-error - A configured capability need not be supported by this account.
    void accountDetails.mayUseVendorArchive;
    // @ts-expect-error - A configured capability need not be supported by the server.
    void sessionDetails.vendorVersion;

    if (accountDetails) {
      expectTypeOf(accountDetails.maxMailboxDepth).toEqualTypeOf<number | null>();
      expectTypeOf(accountDetails.mayUseVendorArchive).toBeBoolean();
      // @ts-expect-error - Only declared metadata fields are available.
      void accountDetails.undeclaredVendorField;
    }

    if (sessionDetails) {
      expectTypeOf(sessionDetails.vendorVersion).toBeString();
      // @ts-expect-error - Only declared metadata fields are available.
      void sessionDetails.undeclaredVendorField;
    }

    expectTypeOf(session.capabilities["urn:example:other"]).toBeUnknown();
    expectTypeOf(await client.refreshSession()).toEqualTypeOf(session);
  });

  it("retains built-in and vendor method contracts for a shared URN", () => {
    const get = client.api.Email.get({ ids: ["email-1"], properties: ["id", "subject"] });
    const archived = client.api.Email.vendorArchive({ ids: ["email-1"] });

    expectTypeOf<Awaited<typeof get>["list"][number]>().toHaveProperty("subject");
    expectTypeOf<Awaited<typeof get>["list"][number]>().not.toHaveProperty("keywords");
    expectTypeOf<Awaited<typeof archived>>().toEqualTypeOf<{ archived: string[] }>();
  });

  it("combines vendor session details with the default core capability", async () => {
    const vendorCore = defineCapability({
      urn: "urn:ietf:params:jmap:core",
      entities: ["Core"],
    }).withMethods<{ Core: {} }, unknown, { vendorVersion: string }>();
    const client = new JsonMetaClient({
      ...options,
      capabilities: [vendorCore],
    });
    const core = (await client.session).capabilities[vendorCore.urn];

    if (core) {
      expectTypeOf(core.maxCallsInRequest).toBeNumber();
      expectTypeOf(core.vendorVersion).toBeString();
    }
  });
});
