import type { Capability } from "../capability.ts";
import type {
  QuotaChanges,
  QuotaGet,
  QuotaQuery,
  QuotaQueryChanges,
} from "../rfc-types/core/index.ts";

export const quota: Capability<
  "Quota",
  {
    Quota: {
      get: QuotaGet.Contract;
      changes: QuotaChanges.Contract;
      query: QuotaQuery.Contract;
      queryChanges: QuotaQueryChanges.Contract;
    };
  },
  "urn:ietf:params:jmap:quota"
> = {
  urn: "urn:ietf:params:jmap:quota",
  entities: ["Quota"],
};
