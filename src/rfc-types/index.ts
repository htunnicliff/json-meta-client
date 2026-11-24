// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

// The `json-meta-client/rfc-types` entry point: the types of the JMAP
// standards that the built-in capabilities are made from, for building
// method contracts in custom capabilities. JSContact (RFC 9553) has its own
// namespace, because some of its names, such as `EmailAddress` and
// `PatchObject`, are also JMAP type names.
export type * from "./contacts/index.ts";
export type * from "./core/index.ts";
export type * from "./mail/index.ts";
export type * as JSContact from "./formats/index.ts";
