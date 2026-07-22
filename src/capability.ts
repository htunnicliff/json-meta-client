import type {
  ChangesArguments,
  ChangesResponse,
  CopyArguments,
  CopyResponse,
  Email,
  EmailBodyPart,
  EmailCreate,
  EmailFilterCondition,
  EmailImport,
  GetArguments,
  GetResponse,
  ID,
  Mailbox,
  MailboxCreate,
  MailboxFilterCondition,
  QueryArguments,
  QueryChangesArguments,
  QueryChangesResponse,
  QueryResponse,
  SetArguments,
  SetError,
  SetResponse,
  WithoutHeaders,
} from "jmap-rfc-types";
import type { SetOptional } from "type-fest";

import type { BatchResult } from "./batcher.ts";
import type { MethodCall } from "./method-calls.ts";
import type { UnpackRefs } from "./ref.ts";
import type {
  AllowRefsInArgs,
  ClientMethod,
  GlobalEntity,
  OptionalAccountId,
} from "./types.ts";

/**
 * Associates a JMAP capability URN with the set of entity (data type) names it
 * unlocks. The client uses these mappings to compute the `using` array for
 * each request based on the methods actually invoked.
 */
export class Capability {
  readonly urn: string;
  readonly entities: ReadonlyArray<GlobalEntity>;

  constructor(options: { urn: string; entities: ReadonlyArray<GlobalEntity> }) {
    this.urn = options.urn;
    this.entities = Array.from(options.entities);
  }
}

export const KNOWN_CAPABILITIES = [
  new Capability({
    urn: "urn:ietf:params:jmap:core",
    entities: ["Core"],
  }),
  new Capability({
    urn: "urn:ietf:params:jmap:mail",
    entities: ["Mailbox", "Thread", "Email", "SearchSnippet"],
  }),
  new Capability({
    urn: "urn:ietf:params:jmap:submission",
    entities: ["Identity", "EmailSubmission"],
  }),
  new Capability({
    urn: "urn:ietf:params:jmap:vacationresponse",
    entities: ["VacationResponse"],
  }),
];

export type GetEmailArguments = {
  accountId: ID;
  ids?: ReadonlyArray<ID> | null;
  properties?: ReadonlyArray<keyof Email> | null;
  bodyProperties?: Array<keyof EmailBodyPart>;
  fetchTextBodyValues?: boolean;
  fetchHTMLBodyValues?: boolean;
  fetchAllBodyValues?: boolean;
  maxBodyValueBytes?: number;
};

type FilterEmailProperties<Properties extends GetEmailArguments["properties"]> = ReadonlyArray<
  Properties extends ReadonlyArray<infer Prop extends string>
    ? {
        [Key in Prop]: Key extends keyof Email ? NonNullable<Email[Key]> : never;
      }
    : WithoutHeaders<Email>
>;

export type GetEmailResponse<Args> = Args extends SetOptional<GetEmailArguments, "accountId">
  ? {
      accountId: ID;
      state: string;
      list: FilterEmailProperties<Args["properties"]>;
      notFound: ReadonlyArray<ID>;
    }
  : never;

type MailboxSetArguments = SetArguments<MailboxCreate> & { onDestroyRemoveEmails?: boolean };

declare module "./types.ts" {
  interface GlobalMethodCalls {
    Core: {};
    Mailbox: {
      get: <const A extends OptionalAccountId<AllowRefsInArgs<GetArguments<Mailbox>>>>(
        args: A,
      ) => BatchResult<MethodCall<UnpackRefs<A>>, GetResponse<Mailbox, UnpackRefs<A>>>;
      changes: ClientMethod<
        ChangesArguments,
        ChangesResponse & { updatedProperties: Array<keyof Mailbox> | null }
      >;
      query: ClientMethod<
        QueryArguments<Mailbox, MailboxFilterCondition> & {
          sortAsTree?: boolean;
          filterAsTree?: boolean;
        },
        QueryResponse
      >;
      queryChanges: ClientMethod<
        QueryChangesArguments<Mailbox, MailboxFilterCondition>,
        QueryChangesResponse
      >;
      set: <const A extends OptionalAccountId<AllowRefsInArgs<MailboxSetArguments>>>(
        args: A,
      ) => BatchResult<MethodCall<UnpackRefs<A>>, SetResponse<Mailbox, UnpackRefs<A>>>;
    };
    Thread: {};
    Email: {
      get: <const A extends OptionalAccountId<AllowRefsInArgs<GetEmailArguments>>>(
        args: A,
      ) => BatchResult<MethodCall<UnpackRefs<A>>, GetEmailResponse<UnpackRefs<A>>>;
      changes: ClientMethod<ChangesArguments, ChangesResponse>;
      query: ClientMethod<
        QueryArguments<Email, EmailFilterCondition> & {
          collapseThreads?: boolean;
        },
        QueryResponse
      >;
      queryChanges: ClientMethod<
        QueryChangesArguments<Email, EmailFilterCondition> & {
          collapseThreads?: boolean;
        },
        QueryChangesResponse
      >;
      set: <const A extends OptionalAccountId<AllowRefsInArgs<SetArguments<EmailCreate>>>>(
        args: A,
      ) => BatchResult<MethodCall<UnpackRefs<A>>, SetResponse<Email, UnpackRefs<A>>>;
      copy: ClientMethod<
        CopyArguments<Pick<Email, "id" | "mailboxIds" | "keywords" | "receivedAt">>,
        CopyResponse<Email>
      >;
      import: ClientMethod<
        {
          accountId: ID;
          ifInState?: string | null;
          emails: Record<ID, EmailImport>;
        },
        {
          accountId: ID;
          oldState: string | null;
          newState: string;
          created: Record<ID, Email> | null;
          notCreated: Record<ID, SetError> | null;
        }
      >;
      parse: ClientMethod<
        {
          accountId: ID;
          blobIds: ID[];
          properties?: Array<keyof Email>;
          bodyProperties?: Array<keyof Email>;
          fetchTextBodyValues?: boolean;
          fetchHTMLBodyValues?: boolean;
          fetchAllBodyValues?: boolean;
          maxBodyValueBytes?: number;
        },
        {
          accountId: ID;
          parsed: Record<ID, Email> | null;
          notParsable: ID[] | null;
          notFound: ID[] | null;
        }
      >;
    };
    SearchSnippet: {};
    Identity: {};
    EmailSubmission: {};
    VacationResponse: {};
  }
}
