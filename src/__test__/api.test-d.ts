import { describe, expectTypeOf, it } from "vitest";

import { Client, ref } from "../index.ts";
import type { Ref } from "../ref.ts";

const client = new Client({
  bearerToken: "token",
  sessionUrl: "https://jmap.example.com/.well-known/jmap",
});

describe("Api accepts typed result references", () => {
  it("allows Ref<ID[]> for Mailbox.get ids from a query", () => {
    const query = client.api.Mailbox.query({ accountId: "a1" });
    void client.api.Mailbox.get({
      accountId: "a1",
      ids: ref(query, "/ids"),
    });

    expectTypeOf(ref(query, "/ids")).toEqualTypeOf<Ref<string[]>>();
  });

  it("allows wildcard Ref<ID[]> for Mailbox.get ids from a prior get", () => {
    const prior = client.api.Mailbox.get({ accountId: "a1", ids: ["mb1"] });
    void client.api.Mailbox.get({
      accountId: "a1",
      ids: ref(prior, "/list/*/id"),
    });

    expectTypeOf(ref(prior, "/list/*/id")).toEqualTypeOf<Ref<string[]>>();
  });

  it("allows nested Ref for Mailbox.set create.parentId", () => {
    const parent = client.api.Mailbox.get({ accountId: "a1", ids: ["mb-parent"] });
    void client.api.Mailbox.set({
      accountId: "a1",
      create: {
        child: {
          name: "Child",
          parentId: ref(parent, "/list/0/id"),
        },
      },
    });
  });

  it("rejects a Ref whose extracted type does not match the argument", () => {
    const query = client.api.Mailbox.query({ accountId: "a1" });

    void client.api.Mailbox.get({
      accountId: "a1",
      // @ts-expect-error — Ref<number> (position) is not assignable to ids
      ids: ref(query, "/position"),
    });
  });
});
