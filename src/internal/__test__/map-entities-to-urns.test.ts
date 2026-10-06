import { describe, expect, it } from "vitest";

import { mapEntitiesToUrns } from "../map-entities-to-urns.ts";

describe("mapEntitiesToUrns", () => {
  it("maps entities to every contributing capability in registration order", () => {
    expect(
      mapEntitiesToUrns([
        { urn: "urn:foo:thing", entities: ["Thing", "Other"] },
        { urn: "urn:zip:zap", entities: ["Thing", "Widget"] },
      ]),
    ).toEqual({
      Thing: ["urn:foo:thing", "urn:zip:zap"],
      Other: ["urn:foo:thing"],
      Widget: ["urn:zip:zap"],
    });
  });

  it("deduplicates repeated registrations of the same URN", () => {
    expect(
      mapEntitiesToUrns([
        { urn: "urn:foo:thing", entities: ["Thing", "Thing"] },
        { urn: "urn:foo:thing", entities: ["Thing"] },
      ]),
    ).toEqual({ Thing: ["urn:foo:thing"] });
  });
});
