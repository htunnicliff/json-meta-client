import type {
  ChangesArguments,
  ChangesResponse,
  GetArguments,
  GetResponse,
  ID,
  QueryArguments,
  QueryChangesArguments,
  QueryChangesResponse,
  QueryResponse,
  SetArguments,
  SetResponse,
} from "jmap-rfc-types";
import type { Entities, SearchSnippet } from "jmap-rfc-types/jmap-mail";

import type { GlobalEntity } from "./types.ts";

/**
 * Associates a JMAP capability URN with the set of entity (data type) names it
 * unlocks. The client uses these mappings to compute the `using` array for
 * each request based on the methods actually invoked.
 */
export class Capability<Entity extends GlobalEntity> {
  readonly urn: string;
  readonly entities: ReadonlyArray<Entity>;

  constructor(options: { urn: string; entities: ReadonlyArray<Entity> }) {
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
] as const;

// =================================
// Standard method groups (rfc8620 § 5)
//
// These helpers compose the standard `/get`, `/changes`, `/set`, `/query`, and
// `/queryChanges` method signatures for a given entity type using the generic
// argument/response types from jmap-rfc-types.
// =================================

interface Getable<T> {
  get<Args extends GetArguments<T>>(args: Args): GetResponse<T, Args>;
}

interface Changeable {
  changes(args: ChangesArguments): ChangesResponse;
}

interface Setable<T extends object> {
  set<Args extends SetArguments<T>>(args: Args): SetResponse<T, Args>;
}

interface Queryable<T extends Record<string, unknown>> {
  query<Args extends QueryArguments<T>>(args: Args): QueryResponse;
  queryChanges<Args extends QueryChangesArguments<T, T>>(args: Args): QueryChangesResponse;
}

declare module "./types.js" {
  interface GlobalMethodCalls {
    Core: {
      echo<T>(input: T): T;
    };
    Mailbox: Getable<Entities["Mailbox"]> &
      Changeable &
      Queryable<Entities["Mailbox"]> &
      Setable<Entities["Mailbox"]>;
    Thread: Getable<Entities["Thread"]> & Changeable;
    Email: Getable<Entities["Email"]> &
      Changeable &
      Queryable<Entities["Email"]> &
      Setable<Entities["Email"]>;
    SearchSnippet: {
      get(args: { accountId: ID; filter?: unknown; emailIds: ReadonlyArray<ID> }): {
        accountId: ID;
        list: ReadonlyArray<SearchSnippet>;
        notFound: ReadonlyArray<ID> | null;
      };
    };
    Identity: Getable<Entities["Identity"]> & Changeable & Setable<Entities["Identity"]>;
    EmailSubmission: Getable<Entities["EmailSubmission"]> &
      Changeable &
      Queryable<Entities["EmailSubmission"]> &
      Setable<Entities["EmailSubmission"]>;
    VacationResponse: Getable<Entities["VacationResponse"]> & Setable<Entities["VacationResponse"]>;
  }
}
