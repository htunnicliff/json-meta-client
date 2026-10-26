import type {
  MethodChanges,
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
}
