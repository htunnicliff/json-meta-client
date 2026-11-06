/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { assertType, describe, expectTypeOf, it } from "vitest";

import type {
  Account,
  CoreEcho,
  Invocation,
  MethodCopy,
  MethodSet,
  PushSubscriptionCreate,
  PushSubscriptionSet,
  Session,
  SetError,
} from "../core/index.ts";
import type { SessionCapabilities } from "../extensions.ts";

interface Example {
  id: string;
  name: string;
  count: number;
}

describe("RFC 8620 types", () => {
  it("requires invocation and echo arguments to be objects", () => {
    assertType<Invocation>(["Core/echo", { value: true }, "call"]);
    assertType<Invocation<Example>>(["Example/get", { id: "id", name: "name", count: 1 }, "call"]);
    // @ts-expect-error RFC 8620 section 3.2 requires a named-argument object.
    assertType<Invocation>(["Core/echo", true, "call"]);
    // @ts-expect-error Core/echo follows the same object argument convention.
    assertType<CoreEcho.Contract["input"]>(true);
    assertType<CoreEcho.Contract["input"]>({ value: true });
  });

  it("requires core session metadata while allowing unsupported and vendor capabilities", () => {
    expectTypeOf<Session["capabilities"]["urn:ietf:params:jmap:core"]>().toEqualTypeOf<
      SessionCapabilities["urn:ietf:params:jmap:core"]
    >();
    expectTypeOf<Session["capabilities"]["urn:ietf:params:jmap:websocket"]>().toEqualTypeOf<
      SessionCapabilities["urn:ietf:params:jmap:websocket"] | undefined
    >();
    expectTypeOf<Session["capabilities"]["https://example.com/jmap"]>().toEqualTypeOf<object>();
    assertType<Account>({
      name: "Shared account",
      isPersonal: false,
      isReadOnly: true,
      accountCapabilities: { "https://example.com/jmap": {} },
    });
    expectTypeOf<{}>().not.toExtend<Session["capabilities"]>();
    // @ts-expect-error RFC 8620 section 2 requires capability values to be objects.
    assertType<Account["accountCapabilities"]>({ "https://example.com/jmap": true });
  });

  it("allows nullable oldState response arguments to be omitted", () => {
    assertType<MethodSet.Output<Example>>({ accountId: "a", newState: "new" });
    assertType<MethodCopy.Output<Example>>({
      fromAccountId: "source",
      accountId: "target",
      newState: "new",
    });
  });

  it("copies an object by id without repeating unchanged properties", () => {
    assertType<MethodCopy.Input<Example>>({
      fromAccountId: "source",
      accountId: "target",
      create: { copy: { id: "original", name: "Renamed copy" } },
    });
  });

  it("separates push creation verification from mutable subscription fields", () => {
    assertType<PushSubscriptionCreate>({
      deviceClientId: "device",
      url: "https://example.com/push",
      verificationCode: null,
    });
    expectTypeOf<{
      deviceClientId: string;
      url: string;
      verificationCode: string;
    }>().not.toExtend<PushSubscriptionCreate>();
    expectTypeOf<{
      id: string;
      deviceClientId: string;
      url: string;
    }>().not.toExtend<PushSubscriptionCreate>();

    type Update = NonNullable<PushSubscriptionSet.Input["update"]>[string];
    assertType<Update>({ verificationCode: "verification", expires: null, types: ["Todo"] });
    expectTypeOf<Update>().not.toHaveProperty("deviceClientId");
    expectTypeOf<Update>().not.toHaveProperty("url");
    expectTypeOf<Update>().not.toHaveProperty("keys");
  });

  it("reports invalid property names that are not part of an entity schema", () => {
    assertType<SetError>({ type: "invalidProperties", properties: ["unexpectedProperty"] });
  });
});
