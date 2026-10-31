import type { Capability } from "../capability.ts";
import type * as Standard from "../standards-types/mail/index.ts";

/**
 * Account limits and features advertised by the JMAP Mail capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc8621.html#section-1.3
 */
type Details = Standard.AccountCapabilities["urn:ietf:params:jmap:mail"];
export interface MailAccountCapabilities extends Details {}

export const mail: Capability<
  "Mailbox" | "Thread" | "Email" | "SearchSnippet",
  {
    Mailbox: {
      get: Standard.MailboxGet.Contract;
      set: Standard.MailboxSet.Contract;
      changes: Standard.MailboxChanges.Contract;
      query: Standard.MailboxQuery.Contract;
      queryChanges: Standard.MailboxQueryChanges.Contract;
    };
    Thread: {
      get: Standard.ThreadGet.Contract;
      changes: Standard.ThreadChanges.Contract;
    };
    Email: {
      get: Standard.EmailGet.Contract;
      changes: Standard.EmailChanges.Contract;
      query: Standard.EmailQuery.Contract;
      queryChanges: Standard.EmailQueryChanges.Contract;
      set: Standard.EmailSet.Contract;
      copy: Standard.EmailCopy.Contract;
      import: Standard.EmailImport.Contract;
      parse: Standard.EmailParse.Contract;
    };
    SearchSnippet: {
      get: Standard.SearchSnippetGet.Contract;
    };
  },
  "urn:ietf:params:jmap:mail",
  MailAccountCapabilities
> = {
  urn: "urn:ietf:params:jmap:mail",
  entities: ["Mailbox", "Thread", "Email", "SearchSnippet"],
};
