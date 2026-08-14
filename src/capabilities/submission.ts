import { defineCapability } from "../capability.ts";

export const submission = defineCapability({
  urn: "urn:ietf:params:jmap:submission",
  entities: ["Identity", "EmailSubmission"],
}).withMethods<{
  Identity: {
    // TODO
  };
  EmailSubmission: {
    // TODO
  };
}>();
