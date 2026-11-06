/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type {
  Comparator,
  MethodChanges,
  MethodCopy,
  MethodGet,
  MethodQuery,
  MethodQueryChanges,
  MethodSet,
  PatchObject,
  PickPropertiesForEntity,
  SetError,
} from "../core/index.ts";

// TODO: Finish mail types

declare module "../extensions.ts" {
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
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-2 */
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

/** @see https://www.rfc-editor.org/info/rfc8621/#section-2 */
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
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-2.1 */
  export interface Input extends MethodGet.Input<Mailbox> {}
  export interface Output<Args> extends MethodGet.Output<Mailbox, Args> {}
  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

export namespace MailboxChanges {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-2.2 */
  export interface Input extends MethodChanges.Input {}
  export interface Output extends MethodChanges.Output {
    updatedProperties?:
      | ("totalEmails" | "unreadEmails" | "totalThreads" | "unreadThreads")[]
      | null;
  }
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-2.3 */
export interface MailboxFilter {
  parentId?: string | null;
  name?: string;
  role?: string | null;
  hasAnyRole?: boolean;
  isSubscribed?: boolean;
}

export namespace MailboxQuery {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-2.3 */
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
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-2.4 */
  export interface Input extends MethodQueryChanges.Input<Mailbox, MailboxFilter> {}
  export interface Output extends MethodQueryChanges.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

type WithoutProperties<Keys extends PropertyKey> = { [Key in Keys]?: never };

export type WritableMailbox = Pick<Mailbox, "name"> &
  Partial<Pick<Mailbox, "parentId" | "role" | "sortOrder" | "isSubscribed">> &
  WithoutProperties<
    "id" | "totalEmails" | "unreadEmails" | "totalThreads" | "unreadThreads" | "myRights"
  >;

export type MailboxUpdate = Omit<WritableMailbox, "role"> & WithoutProperties<"role">;

export namespace MailboxSet {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-2.5 */
  export interface Input extends MethodSet.Input<Mailbox, WritableMailbox, MailboxUpdate> {
    onDestroyRemoveEmails?: boolean;
  }
  export interface Output extends MethodSet.Output<Mailbox> {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-3 */
export interface Thread {
  id: string;
  emailIds: string[];
}

export namespace ThreadGet {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-3.1 */
  export interface Input extends MethodGet.Input<Thread> {}
  export interface Output<Args> extends MethodGet.Output<Thread, Args> {}
  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

export namespace ThreadChanges {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-3.2 */
  export interface Input extends MethodChanges.Input {}
  export interface Output extends MethodChanges.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.1 */
export interface EmailBase {
  id: string;
  blobId: string;
  threadId: string;
  mailboxIds: { [mailboxId: string]: true };
  keywords: {
    $draft?: true;
    $seen?: true;
    $flagged?: true;
    $answered?: true;
    $forwarded?: true;
    $phishing?: true;
    $junk?: true;
    $notjunk?: true;
    [keyword: string]: true | undefined;
  };
  size: number;
  receivedAt: string;
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

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.1 */
export interface EmailComputedFields {
  bodyStructure: EmailBodyPart;
  bodyValues: { [partId: string]: EmailBodyValue };
  textBody: EmailBodyPart[];
  htmlBody: EmailBodyPart[];
  attachments: Omit<EmailBodyPart, "subParts">[];
  hasAttachment: boolean;
  preview: string;
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.1 */
export interface ReadableEmail extends EmailBase, EmailComputedFields {
  [header: `header:${string}`]: unknown;
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.6 */
export interface WritableEmailBodyValue {
  value: string;
  isEncodingProblem?: false;
  isTruncated?: false;
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.6 */
export type WritableEmailBodyPart = Partial<
  Pick<EmailBodySubPart, "name" | "type" | "disposition" | "cid" | "language" | "location">
> & {
  [header: `header:${string}`]: unknown;
  headers?: never;
} & (
    | { partId: string; blobId?: never; charset?: never; size?: never; subParts?: never }
    | { partId?: never; blobId?: never; charset?: string | null; size?: never; subParts?: never }
    | { blobId: string; partId?: never; charset?: string | null; size?: number; subParts?: never }
    | {
        subParts: WritableEmailBodyPart[];
        partId?: never;
        blobId?: never;
        charset?: never;
        size?: never;
      }
  );

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.6 */
export type WritableEmail = WithoutProperties<
  "id" | "blobId" | "threadId" | "size" | "preview" | "hasAttachment"
> &
  Pick<EmailBase, "mailboxIds"> &
  Partial<Omit<EmailBase, "id" | "blobId" | "threadId" | "size" | "mailboxIds" | "headers">> & {
    bodyValues?: { [partId: string]: WritableEmailBodyValue };
    headers?: never;
    [header: `header:${string}`]: unknown;
  } & (
    | {
        bodyStructure: WritableEmailBodyPart;
        textBody?: never;
        htmlBody?: never;
        attachments?: never;
      }
    | {
        bodyStructure?: never;
        textBody?: [WritableEmailBodyPart & { type?: "text/plain" }];
        htmlBody?: [WritableEmailBodyPart & { type: "text/html" }];
        attachments?: WritableEmailBodyPart[];
      }
  );

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.6 */
export type EmailUpdate = Pick<EmailBase, "mailboxIds" | "keywords"> &
  WithoutProperties<
    | Exclude<keyof EmailBase | keyof EmailComputedFields, "mailboxIds" | "keywords">
    | `header:${string}`
  >;

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.1.2.3 */
export interface EmailAddress {
  email: string;
  name: string | null;
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.1.2.4 */
export interface EmailAddressGroup {
  addresses: EmailAddress[];
  name: string | null;
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.1.3 */
export interface EmailHeader {
  name: string;
  value: string;
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.1.4 */
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
  [header: `header:${string}`]: unknown;
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.1.4 */
export interface EmailBodyPart extends EmailBodySubPart {
  subParts?: EmailBodyPart[] | null;
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.1.4 */
export interface EmailBodyValue {
  value: string;
  isEncodingProblem: boolean;
  isTruncated: boolean;
}

export type EmailBodyPartForArgs<Args> = PickPropertiesForEntity<
  EmailBodySubPart,
  Args extends { bodyProperties: infer P } ? { properties: P } : {},
  { defaultProperties: Exclude<keyof EmailBodySubPart, "headers" | `header:${string}`> }
> &
  (Args extends { bodyProperties: readonly (infer P)[] }
    ? "subParts" extends P
      ? { subParts: EmailBodyPartForArgs<Args>[] | null }
      : { subParts?: EmailBodyPartForArgs<Args>[] | null }
    : { subParts?: EmailBodyPartForArgs<Args>[] | null });

export type EmailForArgs<Args> = Omit<ReadableEmail, keyof EmailComputedFields> & {
  bodyStructure: EmailBodyPartForArgs<Args>;
  bodyValues: EmailComputedFields["bodyValues"];
  textBody: EmailBodyPartForArgs<Args>[];
  htmlBody: EmailBodyPartForArgs<Args>[];
  attachments: Omit<EmailBodyPartForArgs<Args>, "subParts">[];
  hasAttachment: boolean;
  preview: string;
};

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.2 */
export type EmailGetDefaultProperties =
  | Exclude<keyof EmailBase, "headers">
  | Exclude<keyof EmailComputedFields, "bodyStructure">;

export namespace EmailGet {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-4.2 */
  export interface Input extends MethodGet.Input<ReadableEmail> {
    bodyProperties?: readonly (keyof EmailBodyPart)[];
    fetchTextBodyValues?: boolean;
    fetchHTMLBodyValues?: boolean;
    fetchAllBodyValues?: boolean;
    maxBodyValueBytes?: number;
  }
  export interface Output<Args> extends Omit<MethodGet.Output<ReadableEmail, Args>, "list"> {
    list: ReadonlyArray<
      PickPropertiesForEntity<
        EmailForArgs<Args>,
        Args,
        { defaultProperties: EmailGetDefaultProperties }
      > &
        Pick<ReadableEmail, "id">
    >;
  }
  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

export namespace EmailChanges {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-4.3 */
  export interface Input extends MethodChanges.Input {}
  export interface Output extends MethodChanges.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.4.1 */
export interface EmailFilter {
  inMailbox?: string;
  inMailboxOtherThan?: string[];
  before?: string;
  after?: string;
  minSize?: number;
  maxSize?: number;
  allInThreadHaveKeyword?: string;
  someInThreadHaveKeyword?: string;
  noneInThreadHaveKeyword?: string;
  hasKeyword?: string;
  notKeyword?: string;
  hasAttachment?: boolean;
  text?: string;
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  subject?: string;
  body?: string;
  header?: [string, string?];
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.4.2 */
export type EmailComparator =
  | Comparator<ReadableEmail>
  | {
      property: "hasKeyword" | "allInThreadHaveKeyword" | "someInThreadHaveKeyword";
      keyword: string;
      isAscending?: boolean;
      collation?: string;
    };

export namespace EmailQuery {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-4.4 */
  export interface Input extends Omit<MethodQuery.Input<ReadableEmail, EmailFilter>, "sort"> {
    sort?: readonly EmailComparator[] | null;
    collapseThreads?: boolean;
  }
  export interface Output extends MethodQuery.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

export namespace EmailQueryChanges {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-4.5 */
  export interface Input extends Omit<
    MethodQueryChanges.Input<ReadableEmail, EmailFilter>,
    "sort"
  > {
    sort?: readonly EmailComparator[] | null;
    collapseThreads?: boolean;
  }
  export interface Output extends MethodQueryChanges.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-10.6.3 */
export interface EmailBlobNotFoundError extends SetError {
  type: "blobNotFound";
  notFound: string[];
}

export namespace EmailSet {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-4.6 */
  export interface Input extends MethodSet.Input<ReadableEmail, WritableEmail, EmailUpdate> {}
  export interface Output extends MethodSet.Output<ReadableEmail, EmailCopyResult> {
    notCreated?: Record<string, SetError & { notFound?: string[] }> | null;
  }
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.7 */
export type EmailCopyResult = Pick<ReadableEmail, "id" | "blobId" | "threadId" | "size">;

export namespace EmailCopy {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-4.7 */
  export interface Input extends MethodCopy.Input<
    Pick<ReadableEmail, "id"> &
      Partial<Pick<ReadableEmail, "mailboxIds" | "keywords" | "receivedAt">>
  > {}
  export interface Output extends MethodCopy.Output<ReadableEmail, EmailCopyResult> {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

export namespace EmailImport {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-4.8 */
  export interface Input {
    accountId: string;
    ifInState?: string | null;
    emails: {
      [id: string]: Pick<ReadableEmail, "blobId" | "mailboxIds"> &
        Partial<Pick<ReadableEmail, "keywords" | "receivedAt">>;
    };
  }
  export interface Output extends Omit<
    MethodCopy.Output<ReadableEmail, EmailCopyResult>,
    "fromAccountId"
  > {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-4.9 */
export type ParsedEmail<Args = {}> = Omit<
  EmailForArgs<Args>,
  "id" | "mailboxIds" | "keywords" | "receivedAt" | "threadId"
> & {
  id: null;
  mailboxIds: null;
  keywords: null;
  receivedAt: null;
  threadId: string | null;
};

export type EmailParseDefaultProperties =
  | "messageId"
  | "inReplyTo"
  | "references"
  | "sender"
  | "from"
  | "to"
  | "cc"
  | "bcc"
  | "replyTo"
  | "subject"
  | "sentAt"
  | "hasAttachment"
  | "preview"
  | "bodyValues"
  | "textBody"
  | "htmlBody"
  | "attachments";

export namespace EmailParse {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-4.9 */
  export interface Input extends Pick<
    EmailGet.Input,
    | "bodyProperties"
    | "fetchTextBodyValues"
    | "fetchHTMLBodyValues"
    | "fetchAllBodyValues"
    | "maxBodyValueBytes"
    | "accountId"
  > {
    blobIds: string[];
    properties?: readonly (keyof ReadableEmail)[];
  }
  export interface Output<Args> {
    accountId: string;
    parsed?: {
      [id: string]: PickPropertiesForEntity<
        ParsedEmail<Args>,
        Args,
        { defaultProperties: EmailParseDefaultProperties }
      >;
    } | null;
    notParsable?: string[] | null;
    notFound?: string[] | null;
  }
  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-5 */
export interface SearchSnippet {
  emailId: string;
  subject: string | null;
  preview: string | null;
}

export namespace SearchSnippetGet {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-5.1 */
  type BaseInput = Pick<MethodQuery.Input<ReadableEmail, EmailFilter>, "accountId" | "filter">;

  export interface Input extends BaseInput {
    emailIds: string[];
  }
  export interface Output {
    accountId: string;
    list: SearchSnippet[];
    notFound?: string[] | null;
  }
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-6 */
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
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-6.1 */
  export interface Input extends MethodGet.Input<Identity> {}
  export interface Output<Args> extends MethodGet.Output<Identity, Args> {}
  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

export namespace IdentityChanges {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-6.2 */
  export interface Input extends MethodChanges.Input {}
  export interface Output extends MethodChanges.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-6.3 */
export type WritableIdentity = WithoutProperties<"id" | "mayDelete"> &
  Pick<Identity, "email"> &
  Partial<Omit<Identity, "id" | "email" | "mayDelete">>;

/** @see https://www.rfc-editor.org/info/rfc8621/#section-6.3 */
export type IdentityUpdate = Omit<Identity, "id" | "email" | "mayDelete"> &
  WithoutProperties<"id" | "email" | "mayDelete">;

export namespace IdentitySet {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-6.3 */
  export interface Input extends MethodSet.Input<Identity, WritableIdentity, IdentityUpdate> {}
  export interface Output extends MethodSet.Output<Identity> {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-7 */
export type UndoStatus = "pending" | "final" | "canceled";

/** @see https://www.rfc-editor.org/info/rfc8621/#section-7 */
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

/** @see https://www.rfc-editor.org/info/rfc8621/#section-7 */
export interface DeliveryStatus {
  smtpReply: string;
  delivered: "queued" | "yes" | "no" | "unknown";
  displayed: "unknown" | "yes";
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-7 */
export interface SubmissionEnvelope {
  mailFrom: SubmissionAddress;
  rcptTo: SubmissionAddress[];
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-7 */
export interface SubmissionAddress {
  email: string;
  parameters?: {
    [name: string]: string | null;
  } | null;
}

export namespace EmailSubmissionGet {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-7.1 */
  export interface Input extends MethodGet.Input<EmailSubmission> {}
  export interface Output<Args> extends MethodGet.Output<EmailSubmission, Args> {}
  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

export namespace EmailSubmissionChanges {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-7.2 */
  export interface Input extends MethodChanges.Input {}
  export interface Output extends MethodChanges.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-7.3 */
export interface EmailSubmissionFilter {
  identityIds?: string[];
  emailIds?: string[];
  threadIds?: string[];
  undoStatus?: UndoStatus;
  before?: string;
  after?: string;
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-7.3 */
export type EmailSubmissionComparator = Comparator<EmailSubmission & { sentAt: string }>;

export namespace EmailSubmissionQuery {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-7.3 */
  export interface Input extends Omit<
    MethodQuery.Input<EmailSubmission, EmailSubmissionFilter>,
    "sort"
  > {
    sort?: readonly EmailSubmissionComparator[] | null;
  }
  export interface Output extends MethodQuery.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

export namespace EmailSubmissionQueryChanges {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-7.4 */
  export interface Input extends Omit<
    MethodQueryChanges.Input<EmailSubmission, EmailSubmissionFilter>,
    "sort"
  > {
    sort?: readonly EmailSubmissionComparator[] | null;
  }
  export interface Output extends MethodQueryChanges.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

export type WritableEmailSubmission = WithoutProperties<
  Exclude<keyof EmailSubmission, "identityId" | "emailId" | "envelope">
> &
  Pick<EmailSubmission, "identityId" | "emailId"> &
  Partial<Pick<EmailSubmission, "envelope">>;

export namespace EmailSubmissionSet {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-7.5 */
  export interface Input extends MethodSet.Input<
    EmailSubmission,
    WritableEmailSubmission,
    { undoStatus: "canceled" } & WithoutProperties<Exclude<keyof EmailSubmission, "undoStatus">>
  > {
    onSuccessUpdateEmail?: { [submissionId: string]: PatchObject<EmailUpdate> } | null;
    onSuccessDestroyEmail?: string[] | null;
  }
  export interface Output extends MethodSet.Output<EmailSubmission> {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc8621/#section-8 */
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
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-8.1 */
  export interface Input extends MethodGet.Input<VacationResponse> {}
  export interface Output<Args> extends MethodGet.Output<VacationResponse, Args> {}
  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

export namespace VacationResponseSet {
  /** @see https://www.rfc-editor.org/info/rfc8621/#section-8.2 */
  export interface Input extends Pick<
    MethodSet.Input<VacationResponse, never, Omit<VacationResponse, "id">>,
    "accountId" | "ifInState"
  > {
    create?: never;
    destroy?: never;
    update?: {
      singleton?: PatchObject<Omit<VacationResponse, "id"> & WithoutProperties<"id">>;
    } | null;
  }
  export interface Output extends MethodSet.Output<VacationResponse> {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}
