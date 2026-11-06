// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { Capability } from "../capability.ts";
import type { BlobUpload, BlobGet, BlobLookup } from "../rfc-types/core/index.ts";
import type { AccountCapabilities } from "../rfc-types/extensions.ts";

/**
 * Account limits and features advertised by the JMAP Blob capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9404.html#section-3.1
 */
export type BlobAccountCapabilities = AccountCapabilities["urn:ietf:params:jmap:blob"];

export const blob: Capability<
  "Blob",
  {
    Blob: {
      upload: BlobUpload.Contract;
      get: BlobGet.Contract;
      lookup: BlobLookup.Contract;
    };
  },
  "urn:ietf:params:jmap:blob",
  BlobAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:blob",
  entities: ["Blob"],
};
