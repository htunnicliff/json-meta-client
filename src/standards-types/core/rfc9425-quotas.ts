declare module "./index.ts" {
  export interface SessionCapabilities {
    "urn:ietf:params:jmap:quota": {};
  }

  export interface AccountCapabilities {
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

  export interface QuotaGetArguments extends GetArguments<Quota> {}

  export interface QuotaGetResponse extends GetResponse<Quota, QuotaGetArguments> {}

  export interface QuotaChangesArguments extends ChangesArguments {}

  export interface QuotaChangesResponse extends ChangesResponse {
    updatedProperties: string[] | null;
    [key: string]: unknown;
  }

  export interface QuotaFilter {
    name: string;
    scope: string;
    resourceType: string;
    type: string;
  }

  export interface QuotaQueryArguments extends QueryArguments<Quota, QuotaFilter> {}

  export interface QuotaQueryResult extends QueryResponse {}

  export type QuotaQueryChangesArguments = QueryChangesArguments<Quota, QuotaFilter>;

  export interface QuotaQueryChangesResponse extends QueryChangesResponse {}
}
