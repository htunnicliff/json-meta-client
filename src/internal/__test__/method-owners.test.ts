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

import { blob, core, mail, smime } from "../../capabilities/index.ts";
import { CapabilityConfigurationError } from "../../errors.ts";
import { mapMethodOwners } from "../method-owners.ts";

describe(mapMethodOwners, () => {
  it("gives Blob/copy to core, which sets no default account", () => {
    const findOwner = mapMethodOwners([core, blob]);
    expect(findOwner("Blob/copy")).toEqual({ urn: core.urn, defaultAccount: null });
  });

  it("gives the other Blob methods to blob", () => {
    const findOwner = mapMethodOwners([core, blob]);
    expect(findOwner("Blob/get")).toEqual({ urn: blob.urn, defaultAccount: "primary" });
  });

  it("gives Blob/copy to core when blob isn't configured", () => {
    const findOwner = mapMethodOwners([core]);
    expect(findOwner("Blob/copy")).toEqual({ urn: core.urn, defaultAccount: null });
    expect(findOwner("Blob/get")).toBeUndefined();
  });

  it("never gives a method call to an extending capability", () => {
    const findOwner = mapMethodOwners([core, mail, smime]);
    expect(findOwner("Email/get")).toEqual({ urn: mail.urn, defaultAccount: "primary" });
    expect(findOwner("SearchSnippet/get")).toEqual({ urn: mail.urn, defaultAccount: "primary" });
  });

  it("leaves Core/echo and PushSubscription calls without an owner", () => {
    const findOwner = mapMethodOwners([core, mail]);
    expect(findOwner("Core/echo")).toBeUndefined();
    expect(findOwner("PushSubscription/get")).toBeUndefined();
  });

  it("lets a listed method beat another capability's wildcard", () => {
    const findOwner = mapMethodOwners([
      { urn: "urn:example:notes", entities: ["Note"] },
      { urn: "urn:example:archive", entities: ["Note"], defaultAccount: { "Note/archive": null } },
    ]);
    expect(findOwner("Note/get")).toEqual({ urn: "urn:example:notes", defaultAccount: "primary" });
    expect(findOwner("Note/archive")).toEqual({ urn: "urn:example:archive", defaultAccount: null });
  });

  it("claims only the listed methods when the setting has no wildcard", () => {
    const findOwner = mapMethodOwners([
      { urn: "urn:example:notes", entities: ["Note"], defaultAccount: { "Note/get": "primary" } },
    ]);
    expect(findOwner("Note/get")).toEqual({ urn: "urn:example:notes", defaultAccount: "primary" });
    expect(findOwner("Note/set")).toBeUndefined();
  });

  it("allows the same claim twice", () => {
    expect(() => mapMethodOwners([core, core, mail, mail])).not.toThrow();
  });

  it("throws when two capabilities claim every method on a shared entity", () => {
    expect(() =>
      mapMethodOwners([
        { urn: "urn:example:notes", entities: ["Note"] },
        { urn: "urn:example:vendor", entities: ["Note"] },
      ]),
    ).toThrow(CapabilityConfigurationError);
  });

  it("throws when two capabilities list the same method", () => {
    expect(() =>
      mapMethodOwners([
        core,
        { urn: "urn:example:vendor", entities: ["Blob"], defaultAccount: { "Blob/copy": null } },
      ]),
    ).toThrow(
      "Capabilities urn:ietf:params:jmap:core and urn:example:vendor both claim Blob/copy in `defaultAccount`",
    );
  });
});
