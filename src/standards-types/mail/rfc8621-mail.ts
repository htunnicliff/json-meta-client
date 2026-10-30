import type {
  MethodChanges,
  MethodCopy,
  MethodGet,
  MethodQuery,
  MethodQueryChanges,
  MethodSet,
  PatchObject,
  PickPropertiesForEntity,
} from "../core/index.ts";

declare module "./index.ts" {
  export interface SessionCapabilities {
    "urn:ietf:params:jmap:mail": {};
    "urn:ietf:params:jmap:submission": {};
    "urn:ietf:params:jmap:vacationresponse": {};
  }

  export interface AccountCapabilities {
    "urn:ietf:params:jmap:mail": {
      maxMailboxesPerEmail: number | null;
      maxMailboxDepth: number | null;
      maxSizeMailboxName: number;
      maxSizeAttachmentsPerEmail: number;
      emailQuerySortOptions: string[];
      mayCreateTopLevelMailbox: boolean;
    };
    "urn:ietf:params:jmap:submission": {
      maxDelayedSend: number;
      submissionExtensions: Record<string, string[]>;
    };
    "urn:ietf:params:jmap:vacationresponse": {};
  }

  export interface Mailbox {
    id: string;
    name: string;
    parentId: string | null;
    /** @see https://www.iana.org/assignments/imap-mailbox-name-attributes */
    role: string | null;
    sortOrder: number;
    totalEmails: number;
    unreadEmails: number;
    totalThreads: number;
    unreadThreads: number;
    myRights: MailboxRights;
    isSubscribed: boolean;
  }

  export interface MailboxRights {
    mayReadItems: boolean;
    mayAddItems: boolean;
    mayRemoveItems: boolean;
    maySetSeen: boolean;
    maySetKeywords: boolean;
    mayCreateChild: boolean;
    mayRename: boolean;
    mayDelete: boolean;
    maySubmit: boolean;
  }

  export namespace MailboxGet {
    export interface Input extends MethodGet.Input<Mailbox> {}
    export interface Output<Args> extends MethodGet.Output<Mailbox, Args> {}
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export namespace MailboxChanges {
    export interface Input extends MethodChanges.Input {}
    export interface Output extends MethodChanges.Output {
      updatedProperties: string[] | null;
    }
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface MailboxFilter {
    parentId: string | null;
    name: string;
    role: string | null;
    hasAnyRole: boolean;
    isSubscribed: boolean;
  }

  export namespace MailboxQuery {
    export interface Input extends MethodQuery.Input<Mailbox, MailboxFilter> {
      sortAsTree?: boolean;
      filterAsTree?: boolean;
    }
    export interface Output extends MethodQuery.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace MailboxQueryChanges {
    export interface Input extends MethodQueryChanges.Input<Mailbox, MailboxFilter> {}
    export interface Output extends MethodQueryChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace MailboxSet {
    export interface Input extends MethodSet.Input<Mailbox> {
      onDestroyRemoveEmails?: boolean;
    }
    export interface Output extends MethodSet.Output<Mailbox> {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface Thread {
    id: string;
    emailIds: string[];
  }

  export namespace ThreadGet {
    export interface Input extends MethodGet.Input<Thread> {}
    export interface Output<Args> extends MethodGet.Output<Thread, Args> {}
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export namespace ThreadChanges {
    export interface Input extends MethodChanges.Input {}
    export interface Output extends MethodChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface EmailBase {
    id: string;
    blobId: string;
    threadId: string;
    mailboxIds: { [mailboxId: string]: boolean };
    keywords: {
      $draft?: boolean;
      $seen?: boolean;
      $flagged?: boolean;
      $answered?: boolean;
      $forwarded?: boolean;
      $phishing?: boolean;
      $junk?: boolean;
      $notjunk?: boolean;
      [keyword: string]: boolean | undefined;
    };
    size: number;
    receivedAt: string;
    // TODO: Parsed Header fields
    headers: EmailHeader[];
    messageId: string[] | null;
    inReplyTo: string[] | null;
    references: string[] | null;
    sender: EmailAddress[] | null;
    from: EmailAddress[] | null;
    to: EmailAddress[] | null;
    cc: EmailAddress[] | null;
    bcc: EmailAddress[] | null;
    replyTo: EmailAddress[] | null;
    subject: string | null;
    sentAt: string | null;
  }

  export interface EmailComputedFields {
    bodyStructure: EmailBodyPart[];
    bodyValues: { [partId: string]: EmailBodyValue };
    textBody: EmailBodyPart[];
    htmlBody: EmailBodyPart[];
    attachments: Omit<EmailBodyPart, "subParts">[];
    hasAttachment: boolean;
    preview: string;
  }

  export interface ReadableEmail extends EmailBase, EmailComputedFields {}

  export type WritableEmail = Omit<EmailBase, "id" | "headers"> &
    (
      | {
          bodyStructure: EmailComputedFields["bodyStructure"];
        }
      | {
          textBody: EmailComputedFields["textBody"];
          htmlBody: EmailComputedFields["htmlBody"];
          attachments: EmailComputedFields["attachments"];
        }
    );

  export interface EmailAddress {
    email: string;
    name?: string;
  }

  export interface EmailAddressGroup {
    addresses: EmailAddress[];
    name?: string;
  }

  export interface EmailHeader {
    name: string;
    value: string;
  }

  export interface EmailBodySubPart {
    partId: string | null;
    blobId: string | null;
    size: number;
    headers: EmailHeader[];
    name: string | null;
    type: string;
    charset: string | null;
    disposition: string | null;
    cid: string | null;
    language: string[] | null;
    location: string | null;
  }

  export interface EmailBodyPart extends EmailBodySubPart {
    subParts: EmailBodySubPart[] | null;
  }

  export interface EmailBodyValue {
    value: string;
    isEncodingProblem: boolean;
    isTruncated: boolean;
  }

  export namespace EmailGet {
    export interface Input extends MethodGet.Input<ReadableEmail> {
      bodyProperties?: (keyof EmailBodyPart)[];
      fetchTextBodyValues?: boolean;
      fetchHTMLBodyValues?: boolean;
      fetchAllBodyValues?: boolean;
      maxBodyValueBytes?: number;
    }
    export interface Output<Args> extends MethodGet.Output<ReadableEmail, Args> {}
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export namespace EmailChanges {
    export interface Input extends MethodChanges.Input {}
    export interface Output extends MethodChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface EmailFilter {
    inMailbox: string;
    inMailboxOtherThan: string[];
    before: string;
    after: string;
    minSize: number;
    maxSize: number;
    allInThreadHaveKeyword: string;
    someInThreadHaveKeyword: string;
    noneInThreadHaveKeyword: string;
    hasKeyword: string;
    notKeyword: string;
    hasAttachment: boolean;
    text: string;
    from: string;
    to: string;
    cc: string;
    bcc: string;
    subject: string;
    body: string;
    header: [string, ...[string]];
  }

  export namespace EmailQuery {
    export interface Input extends MethodQuery.Input<ReadableEmail, EmailFilter> {
      collapseThreads?: boolean;
    }
    export interface Output extends MethodQuery.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace EmailQueryChanges {
    export interface Input extends MethodQueryChanges.Input<ReadableEmail, EmailFilter> {}
    export interface Output extends MethodQueryChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace EmailSet {
    export interface Input extends MethodSet.Input<WritableEmail> {}
    export interface Output extends MethodSet.Output<ReadableEmail> {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export type EmailCopyResult = Pick<ReadableEmail, "id" | "blobId" | "threadId" | "size">;

  export namespace EmailCopy {
    export interface Input extends MethodCopy.Input<
      Pick<ReadableEmail, "id"> &
        Partial<Pick<ReadableEmail, "mailboxIds" | "keywords" | "receivedAt">>
    > {}
    export interface Output extends MethodCopy.Output<EmailCopyResult> {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace EmailImport {
    export interface Input {
      accountId: string;
      ifInState?: string;
      emails: {
        [id: string]: Pick<ReadableEmail, "blobId" | "mailboxIds" | "keywords" | "receivedAt">;
      };
    }
    export interface Output extends Omit<MethodCopy.Output<EmailCopyResult>, "fromAccountId"> {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace EmailParse {
    export interface Input extends Pick<
      EmailGet.Input,
      | "bodyProperties"
      | "fetchTextBodyValues"
      | "fetchHTMLBodyValues"
      | "fetchAllBodyValues"
      | "maxBodyValueBytes"
      | "accountId"
      | "properties"
    > {
      blobIds: string[];
    }
    export interface Output<Args> {
      accountId: string;
      parsed: { [id: string]: PickPropertiesForEntity<ReadableEmail, Args> | null };
      notParsable: string[] | null;
      notFound: string[] | null;
    }
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export interface SearchSnippet {
    emailId: string;
    subject: string | null;
    preview: string | null;
  }

  export namespace SearchSnippetGet {
    type BaseInput = Pick<MethodQuery.Input<ReadableEmail, EmailFilter>, "accountId" | "filter">;

    export interface Input extends BaseInput {
      emailIds: string[];
    }
    export interface Output {
      accountId: string;
      list: SearchSnippet[];
      notFound: string[] | null;
    }
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface Identity {
    id: string;
    name: string;
    email: string;
    replyTo: EmailAddress[] | null;
    bcc: EmailAddress[] | null;
    textSignature: string;
    htmlSignature: string;
    mayDelete: boolean;
  }

  export namespace IdentityGet {
    export interface Input extends MethodGet.Input<Identity> {}
    export interface Output<Args> extends MethodGet.Output<Identity, Args> {}
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export namespace IdentityChanges {
    export interface Input extends MethodChanges.Input {}
    export interface Output extends MethodChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace IdentitySet {
    export interface Input extends MethodSet.Input<Identity> {}
    export interface Output extends MethodSet.Output<Identity> {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export type UndoStatus = "pending" | "final" | "canceled";

  export interface EmailSubmission {
    id: string;
    identityId: string;
    emailId: string;
    threadId: string;
    envelope: SubmissionEnvelope | null;
    sendAt: string;
    undoStatus: UndoStatus;
    deliveryStatus: null | {
      [recipientEmail: string]: DeliveryStatus;
    };
    dsnBlobIds: string[];
    mdnBlobIds: string[];
  }

  export interface DeliveryStatus {
    smtpReply: string;
    delivered: "queued" | "yes" | "no" | "unknown";
    displayed: "unknown" | "yes";
  }

  export interface SubmissionEnvelope {
    mailFrom: SubmissionAddress;
    rcptTo: SubmissionAddress[];
  }

  export interface SubmissionAddress {
    email: string;
    parameters?: {
      [name: string]: string | null;
    };
  }

  export namespace EmailSubmissionGet {
    export interface Input extends MethodGet.Input<EmailSubmission> {}
    export interface Output<Args> extends MethodGet.Output<EmailSubmission, Args> {}
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export namespace EmailSubmissionChanges {
    export interface Input extends MethodChanges.Input {}
    export interface Output extends MethodChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface EmailSubmissionFilter {
    identityIds: string[];
    emailIds: string[];
    threadIds: string[];
    undoStatus: UndoStatus;
    before: string;
    after: string;
  }

  export namespace EmailSubmissionQuery {
    export interface Input extends MethodQuery.Input<EmailSubmission, EmailSubmissionFilter> {}
    export interface Output extends MethodQuery.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace EmailSubmissionQueryChanges {
    export interface Input extends MethodQueryChanges.Input<
      EmailSubmission,
      EmailSubmissionFilter
    > {}
    export interface Output extends MethodQueryChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace EmailSubmissionSet {
    export interface Input extends MethodSet.Input<EmailSubmission> {
      onSuccessUpdateEmail?: { [submissionId: string]: PatchObject<EmailSubmission> };
      onSuccessDestroyEmail?: string[];
    }
    export interface Output extends MethodSet.Output<EmailSubmission> {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface VacationResponse {
    id: "singleton";
    isEnabled: boolean;
    fromDate: string | null;
    toDate: string | null;
    subject: string | null;
    textBody: string | null;
    htmlBody: string | null;
  }

  export namespace VacationResponseGet {
    export interface Input extends MethodGet.Input<VacationResponse> {}
    export interface Output<Args> extends MethodGet.Output<VacationResponse, Args> {}
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export namespace VacationResponseSet {
    export interface Input extends MethodSet.Input<VacationResponse> {}
    export interface Output extends MethodSet.Output<VacationResponse> {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }
}
