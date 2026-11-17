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
 * Base64-encode a username and password for Basic authentication, as UTF-8
 */
export function encodeBasicCredentials(auth: { username: string; password: string }): string {
  const bytes = new TextEncoder().encode(`${auth.username}:${auth.password}`);
  return btoa(Array.from(bytes, (byte) => String.fromCodePoint(byte)).join(""));
}
