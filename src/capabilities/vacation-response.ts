import type { Capability } from "../capability.ts";
import type { VacationResponseGet, VacationResponseSet } from "../rfc-types/mail/index.ts";

// cspell:words vacationresponse

export const vacationResponse: Capability<
  "VacationResponse",
  {
    VacationResponse: {
      get: VacationResponseGet.Contract;
      set: VacationResponseSet.Contract;
    };
  },
  "urn:ietf:params:jmap:vacationresponse"
> = {
  urn: "urn:ietf:params:jmap:vacationresponse",
  entities: ["VacationResponse"],
};
