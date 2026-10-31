import type { MethodGet, MethodChanges, MethodQuery, MethodQueryChanges } from "./rfc8620-jmap.ts";

export interface Rfc9425SessionCapabilities {
  "urn:ietf:params:jmap:quota": {};
}

export interface Rfc9425AccountCapabilities {
  "urn:ietf:params:jmap:quota": {};
}

export type QuotaScope = "account" | "domain" | "global";

export type QuotaResourceType = "count" | "octets";

export interface Quota {
  id: string;
  resourceType: string;
  used: number;
  hardLimit: number;
  scope: QuotaScope;
  name: string;
  types: string[];
  warnLimit?: number | null;
  softLimit?: number | null;
  description?: string | null;
}

export namespace QuotaGet {
  export interface Input extends MethodGet.Input<Quota> {}

  export interface Output<Args> extends MethodGet.Output<Quota, Args> {}

  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

export namespace QuotaChanges {
  export interface Input extends MethodChanges.Input {}

  export interface Output extends MethodChanges.Output {
    updatedProperties: string[] | null;
    [key: string]: unknown;
  }

  export interface Contract {
    input: Input;
    output: Output;
  }
}

export interface QuotaFilter {
  name: string;
  scope: string;
  resourceType: string;
  type: string;
}

export namespace QuotaQuery {
  export interface Input extends MethodQuery.Input<Quota, QuotaFilter> {}

  export interface Output extends MethodQuery.Output {}

  export interface Contract {
    input: Input;
    output: Output;
  }
}

export namespace QuotaQueryChanges {
  export interface Input extends MethodQueryChanges.Input<Quota, QuotaFilter> {}

  export interface Output extends MethodQueryChanges.Output {}

  export interface Contract {
    input: Input;
    output: Output;
  }
}
