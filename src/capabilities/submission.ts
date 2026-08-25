import type { EmailSubmissionContracts, IdentityContracts } from "jmap-rfc-types/contracts";

import { defineCapability } from "../capability.ts";

export const submission = defineCapability({
  urn: "urn:ietf:params:jmap:submission",
  entities: ["Identity", "EmailSubmission"],
}).withMethods<{
  Identity: {
    get: IdentityContracts.Get.Method;
    set: IdentityContracts.Set.Method;
    changes: IdentityContracts.Changes.Method;
  };
  EmailSubmission: {
    get: EmailSubmissionContracts.Get.Method;
    set: EmailSubmissionContracts.Set.Method;
    query: EmailSubmissionContracts.Query.Method;
    queryChanges: EmailSubmissionContracts.QueryChanges.Method;
    changes: EmailSubmissionContracts.Changes.Method;
  };
}>();
