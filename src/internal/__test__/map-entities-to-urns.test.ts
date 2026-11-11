// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { describe, expect, it } from "vitest";

import { mapEntitiesToUrns } from "../map-entities-to-urns.ts";

describe(mapEntitiesToUrns, () => {
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

  it("adds required URNs after the capability's own URN", () => {
    expect(
      mapEntitiesToUrns([
        { urn: "urn:foo:base", entities: ["Thing"] },
        { urn: "urn:foo:extra", entities: ["Extra", "Thing"], requires: ["urn:foo:base"] },
      ]),
    ).toEqual({
      Thing: ["urn:foo:base", "urn:foo:extra"],
      Extra: ["urn:foo:extra", "urn:foo:base"],
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
