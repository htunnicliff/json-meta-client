import type { GlobalEntity } from "./types.ts";

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

declare module "./types.ts" {
  interface GlobalMethodCalls {
    Core: {};
    Mailbox: {};
    Thread: {};
    Email: {};
    SearchSnippet: {};
    Identity: {};
    EmailSubmission: {};
    VacationResponse: {};
  }
}
