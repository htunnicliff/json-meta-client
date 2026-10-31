import type { Capability } from "../capability.ts";
import type * as Standard from "../standards-types/mail/index.ts";

// cspell:words vacationresponse

export const vacationResponse: Capability<
  "VacationResponse",
  {
    VacationResponse: {
      get: Standard.VacationResponseGet.Contract;
      set: Standard.VacationResponseSet.Contract;
    };
  },
  "urn:ietf:params:jmap:vacationresponse"
> = {
  urn: "urn:ietf:params:jmap:vacationresponse",
  entities: ["VacationResponse"],
};
