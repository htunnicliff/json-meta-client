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
 * A `Disposable` that runs the given function, keyed by `Symbol.dispose`
 * where the runtime provides it
 */
export function disposable(dispose: () => void): Disposable {
  return { [Symbol.dispose ?? "disconnect"]: dispose };
}

/**
 * Dispose of a `Disposable` created by this package or by a caller
 */
export function dispose(target: Disposable): void {
  const key = Symbol.dispose ?? "disconnect";
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  (target as unknown as Record<PropertyKey, () => void>)[key]?.();
}
