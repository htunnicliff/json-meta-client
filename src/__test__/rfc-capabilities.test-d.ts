// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { describe, expectTypeOf, it } from "vitest";

import { JsonMetaClient } from "../index.ts";
import type { Quota, SetError } from "../rfc-types/core/index.ts";
import type { MDN } from "../rfc-types/mail/index.ts";

const client = new JsonMetaClient({
  auth: "token",
  sessionUrl: "https://example.test/jmap",
  capabilities: ["blob", "contacts", "sieve", "community:maskedEmail"],
});

describe("RFC capability contracts through the client", () => {
  it("infers echo responses from the supplied arguments", async () => {
    const response = await client.api.Core.echo({ message: "hello", nested: { count: 1 } });
    expectTypeOf(response.message).toBeString();
    expectTypeOf(response.nested.count).toBeNumber();
    expectTypeOf(client.api.Core).not.toHaveProperty("get");
  });

  it("combines core blob copying with typed blob management methods", async () => {
    const uploaded = await client.api.Blob.upload({
      create: { text: { data: [{ "data:asText": "hello" }], type: "text/plain" } },
    });
    expectTypeOf(uploaded.created?.text?.id).toEqualTypeOf<string | undefined>();
    const fetched = await client.api.Blob.get({
      ids: ["blob"],
      properties: ["data:asText", "digest:sha-256"],
      offset: 0,
      length: 5,
    });
    expectTypeOf(fetched.list[0]!["data:asText"]).toEqualTypeOf<string | null | undefined>();
    expectTypeOf(fetched).not.toHaveProperty("state");
    const copied = await client.api.Blob.copy({ fromAccountId: "other", blobIds: ["blob"] });
    expectTypeOf(copied.copied).toEqualTypeOf<Record<string, string> | null | undefined>();
    const found = await client.api.Blob.lookup({ ids: ["blob"], typeNames: ["Email"] });
    expectTypeOf(found.list[0]!.matchedIds).toEqualTypeOf<Record<string, string[]>>();
    // @ts-expect-error Blob/get properties describe JMAP blobs, not browser Blob objects.
    void client.api.Blob.get({ properties: ["arrayBuffer"] });
    const invalidSource = { "data:asText": "hi", "data:asBase64": "aGk=" };
    void client.api.Blob.upload({
      create: {
        bad: {
          // @ts-expect-error A data source must choose one encoding.
          data: [invalidSource],
        },
      },
    });
  });

  it("selects contact properties and carries query references into get calls", async () => {
    const query = client.api.ContactCard.query({
      filter: { inAddressBook: "personal", "name/given": "Ada" },
      sort: [{ property: "name/surname" }],
    });
    const response = await client.api.ContactCard.get({
      ids: query.resultRef("/ids"),
      properties: ["uid", "addressBookIds"],
    });
    expectTypeOf(response.list[0]!).toEqualTypeOf<{
      id: string;
      uid?: string;
      addressBookIds: Record<string, true>;
    }>();
    const books = await client.api.AddressBook.get({ properties: ["name"] });
    expectTypeOf(books.list[0]!).toEqualTypeOf<{ id: string; name: string }>();
    // @ts-expect-error Address books require a name when created.
    void client.api.AddressBook.set({ create: { unnamed: {} } });
    // @ts-expect-error ContactCard filters use address books rather than mailboxes.
    void client.api.ContactCard.query({ filter: { inMailbox: "inbox" } });
  });

  it("selects Sieve properties and returns typed validation errors", async () => {
    const scripts = await client.api.SieveScript.get({ properties: ["name"] });
    expectTypeOf(scripts.list[0]!).toEqualTypeOf<{ id: string; name: string | null }>();
    const result = await client.api.SieveScript.validate({ blobId: "script" });
    expectTypeOf(result.error).toEqualTypeOf<SetError | null>();
    const created = client.api.SieveScript.set({
      create: { script: { blobId: "script" } },
      onSuccessActivateScript: "#script",
    });
    expectTypeOf(created.createdRef("script")).toEqualTypeOf<"#script">();
    // @ts-expect-error Script content must be uploaded before creation.
    void client.api.SieveScript.set({ create: { script: { name: "missing content" } } });
  });

  it("uses the new generic helpers for community masked emails", async () => {
    const result = await client.api.MaskedEmail.get({ properties: ["email"] });
    expectTypeOf(result.list[0]!).toEqualTypeOf<{ id: string; email: string }>();
    const created = client.api.MaskedEmail.set({
      create: { alias: { forDomain: "example.test" } },
    });
    expectTypeOf(created.createdRef("alias")).toEqualTypeOf<"#alias">();
  });

  it("types quota methods without exposing writes", async () => {
    const quotaClient = new JsonMetaClient({
      auth: "token",
      sessionUrl: "https://example.test/jmap",
      capabilities: ["quota"],
    });
    const query = quotaClient.api.Quota.query({ filter: { scope: "account" } });
    const quotas = await quotaClient.api.Quota.get({
      ids: query.resultRef("/ids"),
      properties: ["used", "hardLimit"],
    });
    expectTypeOf(quotas.list[0]!.used).toEqualTypeOf<Quota["used"]>();
    expectTypeOf(quotas.list[0]!).not.toHaveProperty("name");
    expectTypeOf(quotaClient.api.Quota).not.toHaveProperty("set");
    // @ts-expect-error Quota filters do not accept unknown properties.
    void quotaClient.api.Quota.query({ filter: { owner: "me" } });
  });

  it("types principal and share notification methods", async () => {
    const sharingClient = new JsonMetaClient({
      auth: "token",
      sessionUrl: "https://example.test/jmap",
      capabilities: ["sharing"],
    });
    const principals = await sharingClient.api.Principal.get({ properties: ["name", "type"] });
    expectTypeOf(principals.list[0]!.type).toEqualTypeOf<
      "individual" | "group" | "resource" | "location" | "other"
    >();
    void sharingClient.api.Principal.query({ filter: { email: "ada@example.test" } });
    const notifications = await sharingClient.api.ShareNotification.query({
      filter: { objectType: "AddressBook" },
    });
    expectTypeOf(notifications.ids).toEqualTypeOf<string[]>();
    void sharingClient.api.ShareNotification.set({ destroy: ["n1"] });
    // @ts-expect-error Share notifications can only be destroyed.
    void sharingClient.api.ShareNotification.set({ create: { n: {} } });
  });

  it("types MDN sending and parsing", async () => {
    const mdnClient = new JsonMetaClient({
      auth: "token",
      sessionUrl: "https://example.test/jmap",
      capabilities: ["mail", "submission", "mdn"],
    });
    const sent = await mdnClient.api.MDN.send({
      identityId: "identity",
      send: {
        read: {
          forEmailId: "email",
          disposition: {
            actionMode: "manual-action",
            sendingMode: "mdn-sent-manually",
            type: "displayed",
          },
        },
      },
      onSuccessUpdateEmail: { "#read": { "keywords/$mdnsent": true } },
    });
    expectTypeOf(sent.sent).toEqualTypeOf<Record<string, Partial<MDN>> | null | undefined>();
    const parsed = await mdnClient.api.MDN.parse({ blobIds: ["blob"] });
    expectTypeOf(parsed.parsed).toEqualTypeOf<Record<string, MDN> | null | undefined>();
    void mdnClient.api.MDN.send({
      identityId: "identity",
      send: {
        // @ts-expect-error An MDN must name the Email it answers.
        read: {
          disposition: {
            actionMode: "manual-action",
            sendingMode: "mdn-sent-manually",
            type: "displayed",
          },
        },
      },
    });
  });
});
