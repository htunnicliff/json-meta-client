import { describe, expectTypeOf, it } from "vitest";

import { mail } from "../capabilities/index.ts";
import { Client, defineCapability, ref, type MethodContract } from "../index.ts";

interface Note {
  id: string;
  title: string;
  body: string;
}

interface NoteGetOutput<Input> {
  list: readonly Pick<
    Note,
    Input extends { properties: readonly (infer Property extends keyof Note)[] }
      ? Property
      : keyof Note
  >[];
}

interface NoteGet extends MethodContract {
  input: {
    accountId: string;
    ids: readonly string[];
    properties?: readonly (keyof Note)[];
  };
  output: NoteGetOutput<this["input"]>;
}

const notes = defineCapability({
  urn: "urn:example:notes",
  entities: ["Note", "Notebook"],
}).withMethods<{
  Note: {
    get: NoteGet;
    query: {
      input: { accountId: string; text: string };
      output: { ids: string[] };
    };
  };
  Notebook: {
    list: { input: {}; output: { ids: string[] } };
  };
}>();

const archive = defineCapability({
  urn: "urn:example:archive",
  entities: ["Note"],
}).withMethods<{
  Note: {
    archive: { input: { ids: readonly string[] }; output: { archived: string[] } };
    query: {
      input: { accountId: string; text: string };
      output: { ids: string[] };
    };
  };
}>();

const client = new Client({
  sessionUrl: "https://example.test/jmap",
  bearerToken: "token",
  capabilities: [mail, notes, archive],
});

// TODO: Rewrite and simplify this AI-generated test suite

describe("public custom capability authoring", () => {
  it("preserves the URN and declared entity literals", () => {
    expectTypeOf(notes.urn).toEqualTypeOf<"urn:example:notes">();
    expectTypeOf<(typeof notes.entities)[number]>().toEqualTypeOf<"Note" | "Notebook">();
    expectTypeOf(
      defineCapability({ urn: "urn:example:unknown", entities: ["Unknown"] }).urn,
    ).toEqualTypeOf<"urn:example:unknown">();
  });

  it("combines custom methods, shared methods, and built-in capabilities", () => {
    expectTypeOf(client.api.Note).toHaveProperty("get");
    expectTypeOf(client.api.Note).toHaveProperty("archive");
    expectTypeOf(client.api.Notebook).toHaveProperty("list");
    expectTypeOf(client.api.Email).toHaveProperty("get");
    expectTypeOf(client.api.Note).not.toHaveProperty("undeclared");
    const query = client.api.Note.query({ text: "draft" });
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<{ ids: string[] }>();
  });

  it("evaluates argument-dependent outputs and unwraps result references", () => {
    const query = client.api.Note.query({ text: "draft" });
    const selected = client.api.Note.get({
      accountId: "custom-account",
      ids: ref(query, "/ids"),
      properties: ["id", "title"] as const,
    });
    const all = client.api.Note.get({ ids: ["note-1"] });
    expectTypeOf<Awaited<typeof selected>>().toEqualTypeOf<{
      list: readonly Pick<Note, "id" | "title">[];
    }>();
    expectTypeOf<Awaited<typeof all>>().toEqualTypeOf<{ list: readonly Note[] }>();
    expectTypeOf<Parameters<typeof client.api.Note.get>[0]>().not.toExtend<{ accountId: string }>();
  });

  it("allows unknown methods with unknown results on an untyped capability", () => {
    const unknown = defineCapability({ urn: "urn:example:unknown", entities: ["Unknown"] });
    const client = new Client({
      sessionUrl: "https://example.test/jmap",
      bearerToken: "token",
      capabilities: [unknown],
    });
    expectTypeOf<keyof typeof client.api.Unknown>().toEqualTypeOf<string | number>();
    const pending = client.api.Unknown.vendorMethod!({ ids: ["one"] });
    expectTypeOf<Awaited<typeof pending>>().toBeUnknown();
    expectTypeOf(client.api).not.toHaveProperty("Undeclared");
  });

  it("retains known contracts when an untyped capability shares the entity", () => {
    const vendor = defineCapability({ urn: "urn:example:vendor", entities: ["Note"] });
    const client = new Client({
      sessionUrl: "https://example.test/jmap",
      bearerToken: "token",
      capabilities: [notes, vendor],
    });
    const query = client.api.Note.query({ text: "draft" });
    const unknown = client.api.Note.vendorMethod!({ value: 1 });
    expectTypeOf<Awaited<typeof query>>().toEqualTypeOf<{ ids: string[] }>();
    expectTypeOf<Awaited<typeof unknown>>().toBeUnknown();
  });

  it("does not validate incompatible output declarations", () => {
    const first = defineCapability({
      urn: "urn:example:first",
      entities: ["Conflict"],
    }).withMethods<{
      Conflict: { run: { input: { value: string }; output: { result: string } } };
    }>();
    const second = defineCapability({
      urn: "urn:example:second",
      entities: ["Conflict"],
    }).withMethods<{
      Conflict: { run: { input: { value: string }; output: { result: number } } };
    }>();
    const client = new Client({
      sessionUrl: "https://example.test/jmap",
      bearerToken: "token",
      capabilities: [first, second],
    });
    const pending = client.api.Conflict.run({ value: "callable" });
    expectTypeOf<Awaited<typeof pending>["result"]>().toBeNever();
  });

  it("intersects conflicting contracts rather than selecting a provider", () => {
    const first = defineCapability({
      urn: "urn:example:first",
      entities: ["Conflict"],
    }).withMethods<{
      Conflict: { run: { input: { value: string }; output: { result: string } } };
    }>();
    const second = defineCapability({
      urn: "urn:example:second",
      entities: ["Conflict"],
    }).withMethods<{
      Conflict: { run: { input: { value: number }; output: { result: number } } };
    }>();
    const client = new Client({
      sessionUrl: "https://example.test/jmap",
      bearerToken: "token",
      capabilities: [first, second],
    });
    expectTypeOf<
      Extract<Parameters<typeof client.api.Conflict.run>[0]["value"], string | number>
    >().toBeNever();
  });
});
