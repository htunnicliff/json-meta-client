// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { assertType, describe, expectTypeOf, it } from "vitest";

import { JsonMetaClient } from "../index.ts";
import type { Auth, AuthCallback, Config } from "../index.ts";

const sessionUrl = "https://example.test/session";

describe("authentication types", () => {
  it("accepts all credential forms and contextually types callbacks", () => {
    assertType<Auth>({ token: "token" });
    assertType<Auth>({ username: "user", password: "pass" });
    assertType<Auth>({ username: "user", password: "" });
    assertType<object>(
      new JsonMetaClient({ sessionUrl, capabilities: [], auth: { token: "token" } }),
    );
    assertType<object>(
      new JsonMetaClient({
        sessionUrl,
        capabilities: [],
        auth: { username: "user", password: "pass" },
      }),
    );
    const client = new JsonMetaClient({
      sessionUrl,
      capabilities: ["mail"],
      auth: ({ request }) => {
        expectTypeOf(request).toEqualTypeOf<Request>();
        request.headers.set("authorization", "Custom value");
      },
    });
    assertType<object>(
      new JsonMetaClient({
        sessionUrl,
        capabilities: [],
        auth: async ({ request }) => {
          expectTypeOf(request).toEqualTypeOf<Request>();
          await Promise.resolve();
          request.headers.set("x-auth", "value");
        },
      }),
    );
    expectTypeOf(client.api.Mailbox.get).toBeFunction();
    expectTypeOf<AuthCallback>().parameters.toEqualTypeOf<[{ request: Request }]>();
    expectTypeOf<AuthCallback>().returns.toEqualTypeOf<void | Promise<void>>();
    expectTypeOf<Config<[]>>().not.toHaveProperty("bearerToken");
  });

  it("rejects missing, mixed, and wrongly typed credentials including non-literal objects", () => {
    // @ts-expect-error - Authentication is required.
    assertType<object>(new JsonMetaClient({ sessionUrl, capabilities: [] }));
    // @ts-expect-error - The removed option is not an alias.
    assertType<object>(new JsonMetaClient({ sessionUrl, capabilities: [], bearerToken: "token" }));
    // @ts-expect-error - Empty credentials do not select a scheme.
    assertType<Auth>({});
    // @ts-expect-error - Basic requires both username and password.
    assertType<Auth>({ username: "user" });
    // @ts-expect-error - Basic requires both username and password.
    assertType<Auth>({ password: "pass" });
    // @ts-expect-error - Tokens must be strings.
    assertType<Auth>({ token: 42 });
    // @ts-expect-error - Usernames must be strings.
    assertType<Auth>({ username: 42, password: "pass" });
    // @ts-expect-error - Passwords must be strings.
    assertType<Auth>({ username: "user", password: 42 });
    // @ts-expect-error - Credential objects cannot mix schemes.
    assertType<Auth>({ token: "token", username: "user" });
    // @ts-expect-error - Credential objects cannot mix schemes.
    assertType<Auth>({ token: "token", password: "pass" });
    const mixed = { token: "token", username: "user", password: "pass" };
    // @ts-expect-error - Even a variable cannot mix schemes.
    assertType<Auth>(mixed);
    // @ts-expect-error - The constructor enforces the same contract.
    assertType<object>(new JsonMetaClient({ sessionUrl, capabilities: [], auth: mixed }));
    // @ts-expect-error - The callback receives an argument object, not a Request.
    assertType<Auth>((request: Request) => {
      request.headers.set("x-auth", "value");
    });
    // @ts-expect-error - Auth callbacks mutate in place and cannot return a replacement Request.
    assertType<Auth>(async ({ request }) => request);
  });
});
