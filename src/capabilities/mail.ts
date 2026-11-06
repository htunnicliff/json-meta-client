// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type {
  EmailContracts,
  MailboxContracts,
  SearchSnippetContracts,
  ThreadContracts,
} from "jmap-rfc-types/contracts";

import type { Capability } from "../capability.ts";

/**
 * Account limits and features advertised by the JMAP Mail capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8621.html#section-1.3
 */
export interface MailAccountCapabilities {
  maxMailboxesPerEmail: number | null;
  maxMailboxDepth: number | null;
  maxSizeMailboxName: number;
  maxSizeAttachmentsPerEmail: number;
  emailQuerySortOptions: string[];
  mayCreateTopLevelMailbox: boolean;
}

export const mail: Capability<
  "Mailbox" | "Thread" | "Email" | "SearchSnippet",
  {
    Mailbox: {
      get: MailboxContracts.Get.Contract;
      set: MailboxContracts.Set.Contract;
      changes: MailboxContracts.Changes.Contract;
      query: MailboxContracts.Query.Contract;
      queryChanges: MailboxContracts.QueryChanges.Contract;
    };
    Thread: {
      get: ThreadContracts.Get.Contract;
      changes: ThreadContracts.Changes.Contract;
    };
    Email: {
      get: EmailContracts.Get.Contract;
      changes: EmailContracts.Changes.Contract;
      query: EmailContracts.Query.Contract;
      queryChanges: EmailContracts.QueryChanges.Contract;
      set: EmailContracts.Set.Contract;
      copy: EmailContracts.Copy.Contract;
      import: EmailContracts.Import.Contract;
      parse: EmailContracts.Parse.Contract;
    };
    SearchSnippet: {
      get: SearchSnippetContracts.Get.Contract;
    };
  },
  "urn:ietf:params:jmap:mail",
  MailAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Mailbox", "Thread", "Email", "SearchSnippet"],
};
