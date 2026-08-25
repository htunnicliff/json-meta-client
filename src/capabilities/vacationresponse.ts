import type { VacationResponseContracts } from "jmap-rfc-types";

import { defineCapability } from "../capability.ts";

export const vacationresponse = defineCapability({
  urn: "urn:ietf:params:jmap:vacationresponse",
  entities: ["VacationResponse"],
}).withMethods<{
  VacationResponse: {
    get: VacationResponseContracts.Get.Method;
    set: VacationResponseContracts.Set.Method;
  };
}>();
