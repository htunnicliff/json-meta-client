import type { VacationResponseContracts } from "jmap-rfc-types";

import { defineCapability } from "../capability.ts";

export const vacationResponse = defineCapability({
  // spellchecker:disable-next-line
  urn: "urn:ietf:params:jmap:vacationresponse",
  entities: ["VacationResponse"],
}).withMethods<{
  VacationResponse: {
    get: VacationResponseContracts.Get.Contract;
    set: VacationResponseContracts.Set.Contract;
  };
}>();
