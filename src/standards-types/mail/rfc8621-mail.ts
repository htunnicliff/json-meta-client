import type {
  MethodChanges,
  MethodCopy,
  MethodGet,
  MethodQuery,
  MethodQueryChanges,
  MethodSet,
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

  export interface Email {
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

  /**
   * These properties are available on the email interface
   * but must be explicitly requested in a `properties` array
   */
  export interface ComputedEmailFields {
    bodyStructure: EmailBodyPart[];
    bodyValues: { [partId: string]: EmailBodyValue };
    textBody: EmailBodyPart[];
    htmlBody: EmailBodyPart[];
    attachments: Omit<EmailBodyPart, "subParts">[];
    hasAttachment: boolean;
    preview: string;
  }

  export type EmailCreate = /* TODO */ void;

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

  export interface EmailBodyPart {
    partId?: string;
    blobId?: string;
    size: number;
    headers: EmailHeader[];
    name?: string;
    type: string;
    charset?: string;
    disposition?: string;
    cid?: string;
    language?: string[];
    location?: string;
    subParts?: Omit<EmailBodyPart, "subParts">[];
  }

  export interface EmailBodyValue {
    value: string;
    isEncodingProblem: boolean;
    isTruncated: boolean;
  }

  export namespace EmailGet {
    export interface Input extends MethodGet.Input<Email> {
      bodyProperties?: (keyof EmailBodyPart)[];
      fetchTextBodyValues?: boolean;
      fetchHTMLBodyValues?: boolean;
      fetchAllBodyValues?: boolean;
      maxBodyValueBytes?: number;
    }
    export interface Output<Args> extends MethodGet.Output<Email, Args> {}
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
    export interface Input extends MethodQuery.Input<Email, EmailFilter> {
      collapseThreads?: boolean;
    }
    export interface Output extends MethodQuery.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace EmailQueryChanges {
    export interface Input extends MethodQueryChanges.Input<Email, EmailFilter> {}
    export interface Output extends MethodQueryChanges.Output {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace EmailSet {
    export interface Input extends MethodSet.Input<Email> {}
    export interface Output extends MethodSet.Output<Email> {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export namespace EmailCopy {
    export interface Input extends MethodCopy.Input<
      Pick<Email, "id"> & Partial<Pick<Email, "mailboxIds" | "keywords" | "receivedAt">>
    > {}
    export interface Output extends MethodCopy.Output<
      Pick<Email, "id" | "blobId" | "threadId" | "size">
    > {}
    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  // TODO: EmailImport

  // TODO: EmailParse
}
