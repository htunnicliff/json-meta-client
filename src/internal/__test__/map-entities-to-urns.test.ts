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

  it("supports entity names that match Object prototype properties", () => {
    const entities = mapEntitiesToUrns([
      { urn: "urn:foo:thing", entities: ["__proto__", "constructor", "toString"] },
    ]);
    expect(Object.getPrototypeOf(entities)).toBeNull();
    expect(entities["__proto__"]).toEqual(["urn:foo:thing"]);
    expect(entities["constructor"]).toEqual(["urn:foo:thing"]);
    expect(entities["toString"]).toEqual(["urn:foo:thing"]);
  });
});
