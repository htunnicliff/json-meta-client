/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { GetArguments, GetResponse } from "jmap-rfc-types";

import type { Capability } from "../../capability.ts";

/**
 * Account limits and features advertised by the JMAP Blob capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9404.html#section-3.1
 */
export interface BlobAccountCapabilities {
  /** Maximum created blob size in octets, or null for no advertised limit. */
  maxSizeBlobSet: number | null;
  maxDataSources: number;
  supportedTypeNames: string[];
  supportedDigestAlgorithms: string[];
}

export const blob: Capability<
  "Blob",
  {
    Blob: {
      upload: {
        input: any;
        output: any;
      };
      get: {
        input: GetArguments<Blob>;
        output: GetResponse<Blob, any>;
      };
      lookup: {
        input: any;
        output: any;
      };
    };
  },
  "urn:ietf:params:jmap:blob",
  BlobAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:blob",
  entities: ["Blob"],
};
