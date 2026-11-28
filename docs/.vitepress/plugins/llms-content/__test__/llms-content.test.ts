import { describe, expect, it } from "vitest";

import type { BuiltInCapability } from "../../../../reference/capabilities.data.ts";
import { capabilityMarkdown, entitiesMarkdown } from "../index.ts";

const mail: BuiltInCapability = {
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Thread", "Email"],
  methods: { Email: ["get", "set"], Thread: ["get"] },
  accountDetails: [{ name: "maxMailboxDepth", type: "number | null", optional: false }],
  sessionDetails: [],
  spec: { title: "RFC 8621", url: "https://www.rfc-editor.org/info/rfc8621/" },
};

describe(capabilityMarkdown, () => {
  it("lists the fields the capability has", () => {
    expect(capabilityMarkdown("mail", mail)).toBe(
      [
        "### `mail`",
        "",
        "- URN: `urn:ietf:params:jmap:mail`",
        "- Specification: [RFC 8621](https://www.rfc-editor.org/info/rfc8621/)",
        "- Methods: `Email`: `get`, `set`; `Thread`: `get`",
        "- Account details: `maxMailboxDepth: number | null`",
      ].join("\n"),
    );
  });

  it("lists methods without a default account", () => {
    const capability = {
      ...mail,
      defaultAccount: { "Email/get": null, "Email/set": "primary" as const },
    };
    expect(capabilityMarkdown("mail", capability)).toContain("- No default account: `Email/get`");
  });

  it("describes a capability without methods", () => {
    const capability = { ...mail, methods: {}, extends: "urn:ietf:params:jmap:mail" };
    expect(capabilityMarkdown("extension", capability)).toContain(
      "- Methods: None. Adds properties and filter conditions to the methods it extends.",
    );
  });
});

describe(entitiesMarkdown, () => {
  it("lists the capabilities that declare each entity", () => {
    const blob = { ...mail, entities: ["Blob"] };
    expect(entitiesMarkdown({ mail: { ...mail, entities: ["Blob", "Email"] }, blob })).toBe(
      [
        "| Entity | Capabilities |",
        "| --- | --- |",
        "| `Blob` | `mail`, `blob` |",
        "| `Email` | `mail` |",
      ].join("\n"),
    );
  });
});
