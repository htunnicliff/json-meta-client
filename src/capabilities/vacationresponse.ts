import { defineCapability } from "../capability.ts";

export const vacationresponse = defineCapability({
  urn: "urn:ietf:params:jmap:vacationresponse",
  entities: ["VacationResponse"],
}).withMethods<{
  VacationResponse: {
    // TODO
  };
}>();
