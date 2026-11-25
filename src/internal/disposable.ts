// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

/**
 * The key of a dispose method: `Symbol.dispose`, or `"disconnect"` on a
 * runtime without it
 */
export function disposeKey(): symbol | "disconnect" {
  return disposeKeyFor(Symbol.dispose);
}

/**
 * The key of a dispose method on a runtime whose `Symbol.dispose` is the
 * given value
 */
export function disposeKeyFor(symbol: symbol | undefined): symbol | "disconnect" {
  return symbol ?? "disconnect";
}

/**
 * A `Disposable` that runs the given function, keyed by `Symbol.dispose`
 * where the runtime provides it
 */
export function disposable(dispose: () => void): Disposable {
  return { [Symbol.dispose ?? "disconnect"]: dispose };
}

/**
 * Dispose of a `Disposable` created by this package or by a caller
 */
export function dispose(target: object): void {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  (target as Record<PropertyKey, (() => void) | undefined>)[disposeKey()]?.();
}

/**
 * Give an object with a `[Symbol.dispose]` field a `disconnect` method too,
 * on a runtime without `Symbol.dispose`, where that field's key is the
 * string `"undefined"`
 */
export function addDisposeFallback(
  target: object,
  dispose: () => void,
  key: symbol | "disconnect" = disposeKey(),
): void {
  if (typeof key === "string") Object.defineProperty(target, key, { value: dispose });
}
