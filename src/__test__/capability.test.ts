import { describe, expect, it } from "vitest";

import { defineCapability } from "../capability";

describe("Capability", () => {
  it("stores the urn and entities", () => {
    const cap = defineCapability({
      urn: "urn:ietf:params:jmap:mail",
      entities: ["Email", "Mailbox"],
    });

    expect(cap.urn).toBe("urn:ietf:params:jmap:mail");
    expect(cap.entities).toEqual(["Email", "Mailbox"]);
  });

  it("copies the entities array rather than aliasing the input", () => {
    const input = ["Email"] as const;
    const cap = defineCapability({ urn: "urn:example", entities: input });

    expect(cap.entities).not.toBe(input);
    expect(cap.entities).toEqual(["Email"]);
  });
});
