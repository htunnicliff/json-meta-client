import type { VacationResponseContracts } from "jmap-rfc-types";

import type { Capability } from "../capability.ts";

// cspell:words vacationresponse

export const vacationResponse: Capability<
  "VacationResponse",
  {
    VacationResponse: {
      get: VacationResponseContracts.Get.Contract;
      set: VacationResponseContracts.Set.Contract;
    };
  },
  "urn:ietf:params:jmap:vacationresponse"
> = {
  urn: "urn:ietf:params:jmap:vacationresponse",
  entities: ["VacationResponse"],
};
