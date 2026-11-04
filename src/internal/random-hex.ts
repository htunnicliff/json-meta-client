/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

export function randomHex(length: number): string {
  return Array.from(randomHexGenerator(length)).join("");
}

/**
 * Generate hexadecimal characters up to a given length
 */
function* randomHexGenerator(length: number) {
  let yielded = 0;
  const arr = new Uint16Array(8);
  while (yielded < length) {
    crypto.getRandomValues(arr);
    for (const num of arr) {
      for (const char of num.toString(16)) {
        yield char;
        yielded += 1;
        if (yielded == length) {
          return;
        }
      }
    }
  }
}

if (import.meta.main) {
  const [length] = process.argv.slice(2);

  process.stdout.write(randomHex(+length!));
}
