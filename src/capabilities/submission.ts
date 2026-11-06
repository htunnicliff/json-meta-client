// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { Capability } from "../capability.ts";
import type { AccountCapabilities } from "../rfc-types/extensions.ts";
import type {
  EmailSubmissionChanges,
  EmailSubmissionGet,
  EmailSubmissionQuery,
  EmailSubmissionQueryChanges,
  EmailSubmissionSet,
  IdentityChanges,
  IdentityGet,
  IdentitySet,
} from "../rfc-types/mail/index.ts";

/**
 * Account limits and SMTP extensions advertised by the JMAP Submission capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8621.html#section-1.3.2
 */
export type SubmissionAccountCapabilities = AccountCapabilities["urn:ietf:params:jmap:submission"];

export const submission: Capability<
  "Identity" | "EmailSubmission",
  {
    Identity: {
      get: IdentityGet.Contract;
      set: IdentitySet.Contract;
      changes: IdentityChanges.Contract;
    };
    EmailSubmission: {
      get: EmailSubmissionGet.Contract;
      set: EmailSubmissionSet.Contract;
      query: EmailSubmissionQuery.Contract;
      queryChanges: EmailSubmissionQueryChanges.Contract;
      changes: EmailSubmissionChanges.Contract;
    };
  },
  "urn:ietf:params:jmap:submission",
  SubmissionAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:submission",
  entities: ["Identity", "EmailSubmission"],
};
