import { resolve } from "node:path";

import {
  GenericContainer,
  getContainerRuntimeClient,
  RandomPortGenerator,
  Wait,
} from "testcontainers";
import type { TestProject } from "vitest/node";

import { defineCapability, JsonMetaClient } from "../../index.ts";
import type { MethodSet } from "../../rfc-types/core/index.ts";

export interface StalwartUser {
  username: string;
  password: string;
  /** The ID of the user's own account, which is also its principal ID */
  accountId: string;
}

export interface StalwartFixture extends StalwartUser {
  sessionUrl: string;
  /**
   * A second user, who shares a mailbox and an address book with the main
   * user, so that the main user's session has a second account
   */
  other: StalwartUser & {
    sharedMailboxId: string;
    sharedAddressBookId: string;
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    stalwart: StalwartFixture;
  }
}

interface Domain {
  id: string;
  name: string;
}

interface Account {
  id: string;
  "@type": "User";
  name: string;
  domainId: string;
  credentials: Record<string, { "@type": "Password"; secret: string }>;
}

interface Sharing {
  id: string;
  allowDirectoryQueries: boolean;
}

interface Action {
  id: string;
  "@type": "ReloadSettings";
}

/** The parts of Stalwart's management API that provisioning uses */
const stalwartManagement = defineCapability({
  urn: "urn:stalwart:jmap",
  entities: ["x:Domain", "x:Account", "x:Sharing", "x:Action"],
}).withMethods<{
  "x:Domain": { set: { input: MethodSet.Input<Domain>; output: MethodSet.Output<Domain> } };
  "x:Account": { set: { input: MethodSet.Input<Account>; output: MethodSet.Output<Account> } };
  "x:Sharing": { set: { input: MethodSet.Input<Sharing>; output: MethodSet.Output<Sharing> } };
  "x:Action": { set: { input: MethodSet.Input<Action>; output: MethodSet.Output<Action> } };
}>();

interface SharedMailbox {
  id: string;
  name: string;
  shareWith: Record<string, Partial<Record<MailboxRight, boolean>>>;
}

type MailboxRight =
  | "mayReadItems"
  | "mayAddItems"
  | "mayRemoveItems"
  | "maySetSeen"
  | "maySetKeywords";

/**
 * `Mailbox/set` with `shareWith`, which Stalwart supports for mailboxes
 * but the built-in mail capability doesn't declare
 */
const mailboxSharing = defineCapability({
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Mailbox"],
}).withMethods<{
  Mailbox: {
    set: { input: MethodSet.Input<SharedMailbox>; output: MethodSet.Output<SharedMailbox> };
  };
}>();

const admin = { username: "admin", password: "integration-admin-password" };

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  // Stalwart advertises JMAP URLs from STALWART_PUBLIC_URL, which must be known
  // before the container starts, so pick the host port up front.
  const host = (await getContainerRuntimeClient()).info.containerRuntime.host;
  const port = await new RandomPortGenerator().generatePort();
  const baseUrl = `http://${host}:${port}`;

  const container = await new GenericContainer(
    "stalwartlabs/stalwart:v1.1.0@sha256:f772aa6ef8cd8018969fa491640f1436b0270eb14e2c219b5f37f1a77020837e",
  )
    .withCopyFilesToContainer([
      {
        source: resolve(import.meta.dirname, "fixtures/stalwart.json"),
        target: "/etc/stalwart/config.json",
      },
    ])
    .withEnvironment({
      STALWART_RECOVERY_ADMIN: `${admin.username}:${admin.password}`,
      STALWART_PUBLIC_URL: baseUrl,
    })
    .withExposedPorts({ container: 8080, host: port })
    .withWaitStrategy(Wait.forHttp("/healthz/live", 8080).forStatusCode(200))
    .withStartupTimeout(120_000)
    .start();

  try {
    const users = {
      main: { username: "integration@example.test", password: "integration-user-password" },
      other: { username: "other@example.test", password: "other-user-password" },
    };

    // Management calls only provision fixtures; protocol assertions live in the tests.
    const client = new JsonMetaClient({
      sessionUrl: `${baseUrl}/.well-known/jmap`,
      capabilities: [stalwartManagement],
      auth: admin,
    });
    const domains = client.api["x:Domain"].set({
      create: { domain: { name: "example.test" } },
    });
    const accounts = client.api["x:Account"].set({
      create: {
        main: {
          "@type": "User",
          name: "integration",
          domainId: domains.createdRef("domain"),
          credentials: { 0: { "@type": "Password", secret: users.main.password } },
        },
        other: {
          "@type": "User",
          name: "other",
          domainId: domains.createdRef("domain"),
          credentials: { 0: { "@type": "Password", secret: users.other.password } },
        },
      },
    });
    // Allow directory queries for the Principal/query tests. Stalwart applies
    // the setting once the settings are reloaded.
    const sharing = client.api["x:Sharing"].set({
      update: { singleton: { allowDirectoryQueries: true } },
    });
    const reload = client.api["x:Action"].set({
      create: { reload: { "@type": "ReloadSettings" } },
    });
    const results = await Promise.all([domains, accounts, sharing, reload]);
    for (const result of results) {
      const failure = "notCreated" in result ? result.notCreated : result.notUpdated;
      if (failure) {
        throw new Error(`Stalwart fixture provisioning failed: ${JSON.stringify(failure)}`);
      }
    }
    const created = results[1].created!;
    const mainAccountId = created.main!.id;
    const otherAccountId = created.other!.id;

    // The other user shares a mailbox and an address book, which adds their
    // account to the main user's session for the `/copy` tests
    const otherClient = new JsonMetaClient({
      sessionUrl: `${baseUrl}/.well-known/jmap`,
      capabilities: [mailboxSharing, "contacts"],
      auth: users.other,
    });
    const [mailboxes, addressBooks] = await Promise.all([
      otherClient.api.Mailbox.set({
        create: {
          shared: {
            name: "Shared",
            shareWith: {
              [mainAccountId]: {
                mayReadItems: true,
                mayAddItems: true,
                mayRemoveItems: true,
                maySetSeen: true,
                maySetKeywords: true,
              },
            },
          },
        },
      }),
      otherClient.api.AddressBook.set({
        create: {
          shared: {
            name: "Shared",
            shareWith: {
              [mainAccountId]: { mayRead: true, mayWrite: true, mayShare: false, mayDelete: false },
            },
          },
        },
      }),
    ]);
    const sharedMailboxId = mailboxes.created?.shared?.id;
    const sharedAddressBookId = addressBooks.created?.shared?.id;
    if (!sharedMailboxId || !sharedAddressBookId) {
      throw new Error(
        `Stalwart fixture sharing failed: ${JSON.stringify([mailboxes.notCreated, addressBooks.notCreated])}`,
      );
    }

    project.provide("stalwart", {
      sessionUrl: `${baseUrl}/.well-known/jmap`,
      ...users.main,
      accountId: mainAccountId,
      other: { ...users.other, accountId: otherAccountId, sharedMailboxId, sharedAddressBookId },
    });
  } catch (error) {
    await container.stop();
    throw error;
  }

  return async () => {
    await container.stop();
  };
}
