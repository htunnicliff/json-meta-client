import type { EmailSubmissionContracts, IdentityContracts } from "jmap-rfc-types/contracts";

import type { Capability } from "../capability.ts";

/**
 * Account limits and SMTP extensions advertised by the JMAP Submission capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8621.html#section-1.3.2
 */
export interface SubmissionAccountCapabilities {
  /** Maximum send delay in seconds; zero means delayed sending is unsupported. */
  maxDelayedSend: number;
  /** SMTP extension names mapped to their argument lists. */
  submissionExtensions: Record<string, string[]>;
}

export const submission: Capability<
  "Identity" | "EmailSubmission",
  {
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
  },
  "urn:ietf:params:jmap:submission",
  SubmissionAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:submission",
  entities: ["Identity", "EmailSubmission"],
};
