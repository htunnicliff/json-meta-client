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
 * Methods the client never gives a default `accountId`. The caller must pass
 * one, because the client cannot tell which account the call is meant for:
 * `Blob/copy` copies blobs into `accountId`, and nothing in the call says
 * which account that should be.
 */
export const METHODS_WITHOUT_DEFAULT_ACCOUNT_ID = ["Blob/copy"] as const;

export type MethodWithoutDefaultAccountId = (typeof METHODS_WITHOUT_DEFAULT_ACCOUNT_ID)[number];
