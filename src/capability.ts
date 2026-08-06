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
import type { AllowRefsInArgs, ClientMethod, OptionalAccountId } from "./types.ts";

/**
 * The primary type used to define JMAP calls for
 * one or more entities.
 *
 * @example
 * ```ts
 * type Methods = {
 *   Email: {
 *       get: <A>(args: A) => SomeResult<A>;
 *       query: <A>(args: A) => SomeOtherResult<A>;
 *   };
 *   Thread: {};
 *   Mailbox: {};
 *   SearchSnippet: {};
 * };
 * ```
 */
type CapabilityMethods<Entity extends string> = Record<
  Entity,
  Record<string, (...args: any[]) => any>
>;

/**
 * A partially-configured capability that supports using
 * layers of generics. The first layer captures the {@link Entity}
 * type, while the second layer captures the {@link CapabilityMethods}
 */
interface ConfigurableCapability<Entity extends string> {
  urn: string;
  entities: Entity[];
  withMethods<M extends CapabilityMethods<Entity>>(): Capability<Entity, M>;
}

/**
 * A fully configured capability:
 * - Known entities (type and value)
 * - Known urn (value)
 * - Known methods (type)
 */
export interface Capability<Entity extends string, _Methods extends CapabilityMethods<Entity>> {
  urn: string;
  entities: Entity[];
}

/**
 * Extracts the {@link CapabilityMethods} from a configured
 * {@link Capability}
 */
export type InferMethodsFromCapability<C> =
  C extends Capability<infer _Entity, infer Methods> ? Methods : never;

/**
 * Define a JMAP capability for one or more entities
 *
 * @example
 * ```ts
 * const Core = defineCapability({ })
 * ```
 */
export function defineCapability<const Entity extends string>({
  urn,
  entities,
}: {
  urn: string;
  entities: Entity[];
}): ConfigurableCapability<Entity> {
  return {
    urn,
    entities,
    withMethods: () => ({ urn, entities }),
  };
}

export const KNOWN_CAPABILITIES = [
  defineCapability({
    urn: "urn:ietf:params:jmap:core",
    entities: ["Core"],
  }),
  defineCapability({
    urn: "urn:ietf:params:jmap:mail",
    entities: ["Mailbox", "Thread", "Email", "SearchSnippet"],
  }),
  defineCapability({
    urn: "urn:ietf:params:jmap:submission",
    entities: ["Identity", "EmailSubmission"],
  }),
  defineCapability({
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

export type GetEmailResponse<Args> =
  Args extends SetOptional<GetEmailArguments, "accountId">
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
