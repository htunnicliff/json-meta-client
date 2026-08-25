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
    get: MailboxContracts.Get.Method;
    set: MailboxContracts.Set.Method;
    changes: MailboxContracts.Changes.Method;
    query: MailboxContracts.Query.Method;
    queryChanges: MailboxContracts.QueryChanges.Method;
  };
  Thread: {
    get: ThreadContracts.Get.Method;
    changes: ThreadContracts.Changes.Method;
  };
  Email: {
    get: EmailContracts.Get.Method;
    changes: EmailContracts.Changes.Method;
    query: EmailContracts.Query.Method;
    queryChanges: EmailContracts.QueryChanges.Method;
    set: EmailContracts.Set.Method;
    copy: EmailContracts.Copy.Method;
    import: EmailContracts.Import.Method;
    parse: EmailContracts.Parse.Method;
  };
  SearchSnippet: {
    get: SearchSnippetContracts.Get.Method;
  };
}>();
