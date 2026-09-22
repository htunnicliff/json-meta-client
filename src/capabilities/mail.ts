import type {
  EmailContracts,
  MailboxContracts,
  SearchSnippetContracts,
  ThreadContracts,
} from "jmap-rfc-types/contracts";

import { defineCapability } from "../capability.ts";

export const mail = defineCapability({
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Mailbox", "Thread", "Email", "SearchSnippet"],
}).withMethods<{
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
}>();
