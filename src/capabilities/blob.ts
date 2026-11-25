import type { Capability } from "../capability.ts";
import type {
  BlobAccountCapabilities,
  BlobGet,
  BlobLookup,
  BlobUpload,
} from "../rfc-types/core/index.ts";

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
