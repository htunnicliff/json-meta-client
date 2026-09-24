import type { EmailSubmissionContracts, IdentityContracts } from "jmap-rfc-types/contracts";

import { defineCapability } from "../capability.ts";

export const submission = defineCapability({
  urn: "urn:ietf:params:jmap:submission",
  entities: ["Identity", "EmailSubmission"],
}).withMethods<{
  Identity: {
    get: IdentityContracts.Get.Contract;
    set: IdentityContracts.Set.Contract;
    changes: IdentityContracts.Changes.Contract;
  };
  EmailSubmission: {
    get: EmailSubmissionContracts.Get.Contract;
    set: EmailSubmissionContracts.Set.Contract;
    query: EmailSubmissionContracts.Query.Contract;
    queryChanges: EmailSubmissionContracts.QueryChanges.Contract;
    changes: EmailSubmissionContracts.Changes.Contract;
  };
}>();
