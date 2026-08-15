import type {
  ChangesArguments,
  ChangesResponse,
  GetArguments,
  GetResponse,
  ID,
  Mailbox as JMapMailbox,
  MailboxCreate,
  MailboxFilterCondition,
  QueryArguments,
  QueryChangesArguments,
  QueryChangesResponse,
  QueryResponse,
  SetArguments,
  SetResponse,
} from "jmap-rfc-types";

import type { BatchResult } from "../batcher.ts";
import { defineCapability } from "../capability.ts";
import type { MethodCall } from "../method-calls.ts";
import type { UnpackRefs } from "../ref.ts";
import type { AllowRefsInArgs, ClientMethod, OptionalAccountId } from "../types.ts";

export const mail = defineCapability({
  entities: ["Mailbox", "Thread", "Email", "SearchSnippet"],
  urn: "urn:ietf:params:jmap:mail",
}).withMethods<{
  Mailbox: {
    get: Mailbox.Get.Method;
    set: Mailbox.Set.Method;
    changes: Mailbox.Changes.Method;
    query: Mailbox.Query.Method;
    queryChanges: Mailbox.QueryChanges.Method;
  };
  Thread: {
    // TODO
  };
  Email: {
    // TODO
  };
  SearchSnippet: {
    // TODO
  };
}>();

declare namespace Mailbox {
  export namespace Get {
    export type Args = OptionalAccountId<AllowRefsInArgs<GetArguments<JMapMailbox>>>;

    export type Result<A> = BatchResult<
      MethodCall<UnpackRefs<A>>,
      GetResponse<JMapMailbox, UnpackRefs<A> & { accountId: ID }>
    >;

    export type Method = <const A extends Args>(args: A) => Result<A>;
  }

  export namespace Set {
    type Args = OptionalAccountId<
      AllowRefsInArgs<
        SetArguments<MailboxCreate> & {
          onDestroyRemoveEmails?: boolean;
        }
      >
    >;

    type Result<A> = BatchResult<
      MethodCall<UnpackRefs<A>>,
      SetResponse<JMapMailbox, UnpackRefs<A> & { accountId: ID }>
    >;

    export type Method = <const A extends Args>(args: A) => Result<A>;
  }

  export namespace Changes {
    type Args = ChangesArguments;

    type Result = ChangesResponse & { updatedProperties: Array<keyof JMapMailbox> | null };

    export type Method = ClientMethod<Args, Result>;
  }

  export namespace Query {
    type Args = QueryArguments<JMapMailbox, MailboxFilterCondition> & {
      sortAsTree?: boolean;
      filterAsTree?: boolean;
    };

    type Result = QueryResponse;

    export type Method = ClientMethod<Args, Result>;
  }

  export namespace QueryChanges {
    type Args = QueryChangesArguments<JMapMailbox, MailboxFilterCondition>;

    type Result = QueryChangesResponse;

    export type Method = ClientMethod<Args, Result>;
  }
}
