import { describe, expect, it } from "vitest";

import { makeSession } from "../../__test__/fixtures.ts";
import { blob, core, mail, smime } from "../../capabilities/index.ts";
import { CapabilityConfigurationError } from "../../errors/index.ts";
import type { Session } from "../../rfc-types/core/index.ts";
import type { MethodOwner } from "../capability-index.ts";
import { mapEntitiesToUrns, mapMethodOwners, resolveDefaultAccount } from "../capability-index.ts";

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
        { urn: "urn:foo:extra", entities: ["Extra", "Thing"], dependsOn: ["urn:foo:base"] },
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

const urn = "urn:example:tasks";
const owner: MethodOwner = { urn, defaultAccount: "primary" };

/** A session with the given primary accounts and each account's capability URNs */
function sessionWith(
  primaryAccounts: Record<string, string>,
  urnsByAccountId: Record<string, string[]>,
): Session {
  return {
    ...makeSession(),
    primaryAccounts,
    accounts: Object.fromEntries(
      Object.entries(urnsByAccountId).map(([id, urns]) => [
        id,
        {
          name: id,
          isPersonal: true,
          isReadOnly: false,
          accountCapabilities: Object.fromEntries(urns.map((urn) => [urn, {}])),
        },
      ]),
    ),
  };
}

describe(resolveDefaultAccount, () => {
  const session = sessionWith({ [urn]: "primary" }, { primary: [urn], other: [urn] });

  it("gives a method call that no capability owns no default account", () => {
    expect(resolveDefaultAccount(undefined, session)).toEqual({ status: "none" });
  });

  it("gives a method call whose owner sets it to null no default account", () => {
    expect(resolveDefaultAccount({ urn, defaultAccount: null }, session)).toEqual({
      status: "none",
    });
  });

  it("resolves to the session's primary account for the owner's URN", () => {
    expect(resolveDefaultAccount(owner, session)).toEqual({
      status: "resolved",
      accountId: "primary",
    });
  });

  it("ignores the primary accounts of other URNs", () => {
    const session = sessionWith({ "urn:other": "other" }, { other: ["urn:other"], tasks: [urn] });

    expect(resolveDefaultAccount(owner, session)).toEqual({
      status: "resolved",
      accountId: "tasks",
    });
  });

  it("falls back to the only account whose capabilities include the owner's URN", () => {
    const session = sessionWith({}, { mail: ["urn:mail"], tasks: ["urn:mail", urn] });

    expect(resolveDefaultAccount(owner, session)).toEqual({
      status: "resolved",
      accountId: "tasks",
    });
  });

  it("is unavailable when no account's capabilities include the owner's URN", () => {
    const session = sessionWith({}, { mail: ["urn:mail"] });

    expect(resolveDefaultAccount(owner, session)).toEqual({ status: "unavailable" });
  });

  it("is unavailable when the session lists no accounts", () => {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    const session = { primaryAccounts: {} } as Session;

    expect(resolveDefaultAccount(owner, session)).toEqual({ status: "unavailable" });
  });

  it("is ambiguous when several accounts' capabilities include the owner's URN", () => {
    const session = sessionWith({}, { one: [urn], two: [urn], mail: ["urn:mail"] });

    expect(resolveDefaultAccount(owner, session)).toEqual({ status: "ambiguous", urn });
  });
});
