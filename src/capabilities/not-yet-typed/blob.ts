import type { Capability } from "../../capability.ts";
import type * as Standard from "../../standards-types/core/index.ts";

/**
 * Account limits and features advertised by the JMAP Blob capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9404.html#section-3.1
 */
type Details = Standard.AccountCapabilities["urn:ietf:params:jmap:blob"];
export interface BlobAccountCapabilities extends Details {}

export const blob: Capability<
  "Blob",
  {
    Blob: {
      upload: Standard.BlobUpload.Contract;
      get: Standard.BlobGet.Contract;
      lookup: Standard.BlobLookup.Contract;
    };
  },
  "urn:ietf:params:jmap:blob",
  BlobAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:blob",
  entities: ["Blob"],
};
