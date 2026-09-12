import { describe, expect, it } from "vitest";

import { mapEntitiesToUrns } from "../map-entities-to-urns";
describe("mapEntitiesToUrns", () => {
  it("maps entities to urns for a single capability", () => {
    expect(
      mapEntitiesToUrns([
        {
          urn: "urn:foo:thing",
          entities: ["Thing1", "Thing2"],
        },
      ]),
    ).toStrictEqual({
      Thing1: "urn:foo:thing",
      Thing2: "urn:foo:thing",
    });
  });

  it("maps entities to urns for multiple capabilities", () => {
    expect(
      mapEntitiesToUrns([
        {
          urn: "urn:foo:thing",
          entities: ["Thing1", "Thing2"],
        },
        {
          urn: "urn:zap:zip",
          entities: ["Widget", "Whatsit", "Wow"],
        },
      ]),
    ).toStrictEqual({
      Thing1: "urn:foo:thing",
      Thing2: "urn:foo:thing",
      Widget: "urn:zap:zip",
      Whatsit: "urn:zap:zip",
      Wow: "urn:zap:zip",
    });
  });

  it("throws when an entity is passed in more than once", () => {
    expect(() =>
      mapEntitiesToUrns([
        {
          urn: "urn:foo:thing",
          entities: ["Thing1", "Thing2", "Thing2"],
        },
      ]),
    ).toThrow('Entity "Thing2" has already been added');

    expect(() =>
      mapEntitiesToUrns([
        {
          urn: "urn:foo:thing",
          entities: ["Thing1", "Thing2"],
        },
        {
          urn: "urn:zip:zap",
          entities: ["Almost", "Unique", "Enough", "Thing1"],
        },
      ]),
    ).toThrow('Entity "Thing1" has already been added');
  });
});
