// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { describe, expectTypeOf, it } from "vitest";

import { addDisposeFallback, disposable, dispose } from "../disposable.ts";
import type { DisposeFallback } from "../disposable.ts";

describe("disposable types", () => {
  it("narrows the target of addDisposeFallback to have a disconnect fallback", () => {
    const target = { name: "target" };
    addDisposeFallback(target, () => {});

    expectTypeOf(target).toEqualTypeOf<{ name: string } & DisposeFallback>();
    expectTypeOf(target.name).toEqualTypeOf<string>();
    expectTypeOf(target.disconnect).toEqualTypeOf<(() => void) | undefined>();
  });

  it("returns a Disposable with the fallback from disposable", () => {
    expectTypeOf(disposable(() => {})).toEqualTypeOf<Disposable & DisposeFallback>();
  });

  it("disposes either kind of disposable", () => {
    expectTypeOf(dispose).toBeCallableWith(disposable(() => {}));
    expectTypeOf(dispose).toBeCallableWith({ disconnect: () => {} });
    expectTypeOf(dispose).toBeCallableWith({ [Symbol.dispose]: () => {} });
  });
});
