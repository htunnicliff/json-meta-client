import { expectTypeOf, it } from "vitest";

import { JsonMetaClient } from "../index.ts";
import type { JmapCore, JmapMail } from "../index.ts";

const client = new JsonMetaClient({
  bearerToken: "test",
  sessionUrl: "https://example.test/session",
  capabilities: ["mail", "blob", "submission", "vacationResponse"],
});

it("projects get results and keeps the implicit id", () => {
  const call = client.api.Mailbox.get({ properties: ["name"] as const });
  expectTypeOf(call)
    .resolves.toHaveProperty("list")
    .items.toEqualTypeOf<Pick<JmapMail.Mailbox, "id" | "name">>();
  expectTypeOf(client.api.Mailbox.get({ properties: null }))
    .resolves.toHaveProperty("list")
    .items.toEqualTypeOf<JmapMail.Mailbox>();
  expectTypeOf(client.api.Mailbox.get({}))
    .resolves.toHaveProperty("list")
    .items.toEqualTypeOf<JmapMail.Mailbox>();
  expectTypeOf(call.resultRef("/list/*/id")).toMatchTypeOf<{ path: string }>();
});

it("preserves echo arguments and exposes blob upload contracts", () => {
  expectTypeOf(client.api.Core.echo({ hello: "world" as const })).resolves.toEqualTypeOf<{
    hello: "world";
  }>();
  const upload = client.api.Blob.upload({
    create: { text: { data: [{ "data:asText": "Hello" }] } },
  });
  expectTypeOf(upload).resolves.toEqualTypeOf<JmapCore.BlobUpload.Output>();
  void client.api.Blob.get({ ids: ["blob"], properties: ["data:asText", "digest:sha-256"] });
  // @ts-expect-error Blob properties are wire property names.
  void client.api.Blob.get({ properties: [{ size: 1 }] });
  // @ts-expect-error Upload objects contain data sources.
  void client.api.Blob.upload({ create: { bad: { accountId: "account" } } });
});
