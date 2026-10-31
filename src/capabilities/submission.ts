import type { Capability } from "../capability.ts";
import type * as Standard from "../standards-types/mail/index.ts";

/**
 * Account limits and SMTP extensions advertised by the JMAP Submission capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8621.html#section-1.3.2
 */
type Details = Standard.AccountCapabilities["urn:ietf:params:jmap:submission"];
export interface SubmissionAccountCapabilities extends Details {}

export const submission: Capability<
  "Identity" | "EmailSubmission",
  {
    Identity: {
      get: Standard.IdentityGet.Contract;
      set: Standard.IdentitySet.Contract;
      changes: Standard.IdentityChanges.Contract;
    };
    EmailSubmission: {
      get: Standard.EmailSubmissionGet.Contract;
      set: Standard.EmailSubmissionSet.Contract;
      query: Standard.EmailSubmissionQuery.Contract;
      queryChanges: Standard.EmailSubmissionQueryChanges.Contract;
      changes: Standard.EmailSubmissionChanges.Contract;
    };
  },
  "urn:ietf:params:jmap:submission",
  SubmissionAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:submission",
  entities: ["Identity", "EmailSubmission"],
};
