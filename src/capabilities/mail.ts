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
import type {
  EmailChanges,
  EmailCopy,
  EmailGet,
  EmailImport,
  EmailParse,
  EmailQuery,
  EmailQueryChanges,
  EmailSet,
  MailAccountCapabilities,
  MailboxChanges,
  MailboxGet,
  MailboxQuery,
  MailboxQueryChanges,
  MailboxSet,
  SearchSnippetGet,
  ThreadChanges,
  ThreadGet,
} from "../rfc-types/mail/index.ts";

export const mail: Capability<
  "Mailbox" | "Thread" | "Email" | "SearchSnippet",
  {
    Mailbox: {
      get: MailboxGet.Contract;
      set: MailboxSet.Contract;
      changes: MailboxChanges.Contract;
      query: MailboxQuery.Contract;
      queryChanges: MailboxQueryChanges.Contract;
    };
    Thread: {
      get: ThreadGet.Contract;
      changes: ThreadChanges.Contract;
    };
    Email: {
      get: EmailGet.Contract;
      changes: EmailChanges.Contract;
      query: EmailQuery.Contract;
      queryChanges: EmailQueryChanges.Contract;
      set: EmailSet.Contract;
      copy: EmailCopy.Contract;
      import: EmailImport.Contract;
      parse: EmailParse.Contract;
    };
    SearchSnippet: {
      get: SearchSnippetGet.Contract;
    };
  },
  "urn:ietf:params:jmap:mail",
  MailAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Mailbox", "Thread", "Email", "SearchSnippet"],
};
