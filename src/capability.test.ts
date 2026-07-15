import { describe, expect, it } from "vitest";

import { Capability, KNOWN_CAPABILITIES } from "./capability.js";

describe("Capability", () => {
  it("stores the urn and entities", () => {
    const cap = new Capability({
      urn: "urn:ietf:params:jmap:mail",
      entities: ["Email", "Mailbox"],
    });

    expect(cap.urn).toBe("urn:ietf:params:jmap:mail");
    expect(cap.entities).toEqual(["Email", "Mailbox"]);
  });

  it("copies the entities array rather than aliasing the input", () => {
    const input = ["Email"] as const;
    const cap = new Capability({ urn: "urn:example", entities: input });

    expect(cap.entities).not.toBe(input);
    expect(cap.entities).toEqual(["Email"]);
  });
});

describe("KNOWN_CAPABILITIES", () => {
  it("includes the JMAP core capability", () => {
    const core = KNOWN_CAPABILITIES.find((c) => c.urn === "urn:ietf:params:jmap:core");
    expect(core?.entities).toContain("Core");
  });

  it("maps the mail capability to the mail entities", () => {
    const mail = KNOWN_CAPABILITIES.find((c) => c.urn === "urn:ietf:params:jmap:mail");
    expect(mail?.entities).toEqual(["Mailbox", "Thread", "Email", "SearchSnippet"]);
  });

  it("has no duplicate urns", () => {
    const urns = KNOWN_CAPABILITIES.map((c) => c.urn);
    expect(new Set(urns).size).toBe(urns.length);
  });

  it("exposes every capability as a Capability instance", () => {
    for (const cap of KNOWN_CAPABILITIES) {
      expect(cap).toBeInstanceOf(Capability);
    }
  });
});
