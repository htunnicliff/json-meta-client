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
