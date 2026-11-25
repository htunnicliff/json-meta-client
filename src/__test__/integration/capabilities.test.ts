// A round trip for each built-in capability beyond mail that Stalwart
// supports.

// cspell:words fileinto

import { describe, expect, inject, it } from "vitest";

import { createClient, createOtherClient, uniqueName } from "./client.ts";

describe("contacts", () => {
  it("creates a contact card in an address book, then queries and gets it", async () => {
    const client = createClient("contacts");
    const books = await client.api.AddressBook.get({});
    expect(books.list.length).toBeGreaterThan(0);
    const addressBookId = books.list[0]!.id;
    const name = uniqueName("Ada");

    const created = await client.api.ContactCard.set({
      create: {
        card: {
          "@type": "Card",
          version: "1.0",
          uid: `urn:uuid:${crypto.randomUUID()}`,
          addressBookIds: { [addressBookId]: true },
          name: { full: name },
          emails: { work: { "@type": "EmailAddress", address: "ada@example.test" } },
        },
      },
    });
    expect(created.notCreated).toBeFalsy();
    const cardId = created.created!.card!.id;

    const query = client.api.ContactCard.query({ filter: { inAddressBook: addressBookId } });
    const cards = await client.api.ContactCard.get({
      ids: query.resultRef("/ids"),
      properties: ["name", "emails"],
    });

    expect(cards.list).toContainEqual({
      id: cardId,
      name: expect.objectContaining({ full: name }),
      emails: { work: expect.objectContaining({ address: "ada@example.test" }) },
    });
  });

  it("copies a contact card from another account", async () => {
    const { accountId, other } = inject("stalwart");
    const name = uniqueName("Grace");
    const source = await createOtherClient("contacts").api.ContactCard.set({
      create: {
        card: {
          "@type": "Card",
          version: "1.0",
          uid: `urn:uuid:${crypto.randomUUID()}`,
          addressBookIds: { [other.sharedAddressBookId]: true },
          name: { full: name },
        },
      },
    });
    const sourceId = source.created!.card!.id;

    const client = createClient("contacts");
    const books = await client.api.AddressBook.get({ accountId });
    const addressBookId = books.list[0]!.id;
    const copied = await client.api.ContactCard.copy({
      fromAccountId: other.accountId,
      accountId,
      create: { copy: { id: sourceId, addressBookIds: { [addressBookId]: true } } },
    });
    expect(copied.notCreated).toBeFalsy();

    const cards = await client.api.ContactCard.get({
      ids: [copied.created!.copy!.id],
      properties: ["name", "addressBookIds"],
    });
    expect(cards.list).toEqual([
      expect.objectContaining({
        name: expect.objectContaining({ full: name }),
        addressBookIds: { [addressBookId]: true },
      }),
    ]);
  });
});

describe("sieve", () => {
  it("validates a script, stores it, and gets it back", async () => {
    const client = createClient("sieve");
    const session = await client.session;
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:sieve"]!;
    const script =
      'require "fileinto";\nif header :contains "subject" "invoice" {\n  fileinto "Invoices";\n}\n';
    const { blobId } = await client.blob.upload(new Blob([script], { type: "application/sieve" }), {
      accountId,
    });

    const validation = await client.api.SieveScript.validate({ blobId });
    expect(validation.error).toBeNull();

    const name = uniqueName("Invoices");
    const created = await client.api.SieveScript.set({ create: { script: { name, blobId } } });
    expect(created.notCreated).toBeFalsy();
    const scriptId = created.created!.script!.id;

    const scripts = await client.api.SieveScript.get({ ids: [scriptId] });
    expect(scripts.list[0]).toMatchObject({ id: scriptId, name });

    const destroyed = await client.api.SieveScript.set({ destroy: [scriptId] });
    expect(destroyed.destroyed).toEqual([scriptId]);
  });

  it("reports an invalid script", async () => {
    const client = createClient("sieve");
    const session = await client.session;
    const accountId = session.primaryAccounts["urn:ietf:params:jmap:sieve"]!;
    const { blobId } = await client.blob.upload(
      new Blob(["if this is not sieve"], { type: "application/sieve" }),
      { accountId },
    );

    const validation = await client.api.SieveScript.validate({ blobId });
    // RFC 9661 names this error `invalidSieve`; Stalwart reports `invalidScript`.
    expect(validation.error).toMatchObject({
      type: expect.any(String),
      description: expect.any(String),
    });
  });
});

describe("quota", () => {
  it("queries the account's quotas and gets them", async () => {
    const client = createClient("quota");

    const query = client.api.Quota.query({});
    const quotas = await client.api.Quota.get({ ids: query.resultRef("/ids") });

    expect(quotas.list.length).toBe((await query).ids.length);
    for (const quota of quotas.list) {
      expect(quota).toMatchObject({
        id: expect.any(String),
        used: expect.any(Number),
        resourceType: expect.any(String),
        scope: expect.any(String),
      });
    }
  });
});

describe("sharing", () => {
  it("gets principals and share notifications", async () => {
    const client = createClient("sharing");

    const [principals, shares] = await Promise.all([
      client.api.Principal.get({}),
      client.api.ShareNotification.get({}),
    ]);

    expect(principals.list).toContainEqual(expect.objectContaining({ type: "individual" }));
    expect(shares.list).toEqual(expect.any(Array));
  });

  it("queries principals and gets them by reference", async () => {
    const { accountId, other } = inject("stalwart");
    const client = createClient("sharing");

    const query = client.api.Principal.query({});
    const principals = await client.api.Principal.get({
      ids: query.resultRef("/ids"),
      properties: ["name", "type"],
    });

    expect((await query).ids).toEqual(expect.arrayContaining([accountId, other.accountId]));
    expect(principals.list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: other.accountId, type: "individual" }),
      ]),
    );
  });
});
