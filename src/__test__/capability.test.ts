import { describe, expect, it } from "vitest";

import { defineCapability } from "../capability";

const cap = defineCapability({
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Email", "Mailbox"],
});

describe("Capability", () => {
  it("stores the urn and entities", () => {
    expect(cap.urn).toBe("urn:ietf:params:jmap:mail");
    expect(cap.entities).toEqual(["Email", "Mailbox"]);
  });

  it("provides withMethods only on the parent", () => {
    const withMethods = cap.withMethods();
    expect(withMethods).not.toHaveProperty("withMethods");
    expect(withMethods.urn).toBe("urn:ietf:params:jmap:mail");
    expect(withMethods.entities).toEqual(["Email", "Mailbox"]);
  });
});
