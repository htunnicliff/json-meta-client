// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { EmptyCapabilityDetails } from "../core/index.ts";
// cspell:words smime smimeverify

/** Server-wide details for `urn:ietf:params:jmap:smimeverify`. */
export type SmimeVerifySessionCapabilities = EmptyCapabilityDetails;

/** Per-account details for `urn:ietf:params:jmap:smimeverify`. */
export type SmimeVerifyAccountCapabilities = EmptyCapabilityDetails;

/**
 * Servers may return additional status tokens defined by future extensions.
 * @see https://www.rfc-editor.org/info/rfc9219/#section-4.1
 */
export type SmimeStatus =
  | "unknown"
  | "signed"
  | "signed/verified"
  | "signed/failed"
  | "encrypted+signed/verified"
  | "encrypted+signed/failed"
  | (string & {});

/** @see https://www.rfc-editor.org/info/rfc9219/#section-4.1 */
export interface EmailSmimeProperties {
  smimeStatus: SmimeStatus | null;
  smimeStatusAtDelivery: SmimeStatus | null;
  smimeErrors: string[] | null;
  smimeVerifiedAt: string | null;
}

/** @see https://www.rfc-editor.org/info/rfc9219/#section-4.2 */
export interface EmailSmimeFilter {
  hasSmime?: boolean;
  hasVerifiedSmime?: boolean;
}
