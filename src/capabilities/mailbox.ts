// oxlint-disable typescript/no-unsafe-type-assertion
import type {
  ChangesArguments,
  ChangesResponse,
  GetArguments,
  GetResponse,
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
import { Capability } from "../capability.ts";
import type { MethodCall } from "../method-calls.ts";
import type { UnpackRefs } from "../ref.ts";
import type { AllowRefsInArgs, ClientMethod, OptionalAccountId } from "../types.ts";

export const Mailbox = new Capability<{
  get: <const A extends OptionalAccountId<AllowRefsInArgs<GetArguments<JMapMailbox>>>>(
    args: A,
  ) => BatchResult<MethodCall<UnpackRefs<A>>, GetResponse<JMapMailbox, UnpackRefs<A>>>;
  set: <
    const A extends OptionalAccountId<
      AllowRefsInArgs<
        SetArguments<MailboxCreate> & {
          onDestroyRemoveEmails?: boolean;
        }
      >
    >,
  >(
    args: A,
  ) => BatchResult<MethodCall<UnpackRefs<A>>, SetResponse<JMapMailbox, UnpackRefs<A>>>;
  changes: ClientMethod<
    ChangesArguments,
    ChangesResponse & { updatedProperties: Array<keyof JMapMailbox> | null }
  >;
  query: ClientMethod<
    QueryArguments<JMapMailbox, MailboxFilterCondition> & {
      sortAsTree?: boolean;
      filterAsTree?: boolean;
    },
    QueryResponse
  >;
  queryChanges: ClientMethod<
    QueryChangesArguments<JMapMailbox, MailboxFilterCondition>,
    QueryChangesResponse
  >;
}>({
  name: "Mailbox",
  urn: "urn:ietf:params:jmap:mail",
});

const foo = {
  name: "Mailbox",
  urn: "urn:ietf:params:jmap:mail",
  $methods: {} as {
    get: <const A extends OptionalAccountId<AllowRefsInArgs<GetArguments<JMapMailbox>>>>(
      args: A,
    ) => BatchResult<MethodCall<UnpackRefs<A>>, GetResponse<JMapMailbox, UnpackRefs<A>>>;
  },
};
