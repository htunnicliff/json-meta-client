import { describe, expectTypeOf, it } from "vitest";

import * as root from "../index.ts";

describe("package root", () => {
  it("does not export built-in capabilities", () => {
    type BuiltIn = "contacts" | "core" | "mail" | "submission" | "vacationresponse";
    expectTypeOf<Extract<keyof typeof root, BuiltIn>>().toEqualTypeOf<never>();
  });
});
