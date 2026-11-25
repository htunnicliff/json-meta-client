import type { MethodChanges, MethodGet, MethodQuery, MethodQueryChanges } from "./rfc8620-jmap.ts";

/** @see https://www.rfc-editor.org/info/rfc9425/#section-3.1 */
export type QuotaScope = "account" | "domain" | "global";

/** @see https://www.rfc-editor.org/info/rfc9425/#section-3.2 */
export type QuotaResourceType = "count" | "octets";

/** @see https://www.rfc-editor.org/info/rfc9425/#section-4.1 */
export interface Quota {
  id: string;
  resourceType: QuotaResourceType;
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
  /** @see https://www.rfc-editor.org/info/rfc9425/#section-4.2 */
  export interface Input extends MethodGet.Input<Quota> {}

  export interface Output<Args> extends MethodGet.Output<Quota, Args> {}

  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

export namespace QuotaChanges {
  /** @see https://www.rfc-editor.org/info/rfc9425/#section-4.3 */
  export interface Input extends MethodChanges.Input {}

  export interface Output extends MethodChanges.Output {
    updatedProperties?: string[] | null;
    [key: string]: unknown;
  }

  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc9425/#section-4.4 */
export interface QuotaFilter {
  name?: string;
  scope?: string;
  resourceType?: string;
  type?: string;
}

export namespace QuotaQuery {
  /** @see https://www.rfc-editor.org/info/rfc9425/#section-4.4 */
  export interface Input extends MethodQuery.Input<Quota, QuotaFilter> {}

  export interface Output extends MethodQuery.Output {}

  export interface Contract {
    input: Input;
    output: Output;
  }
}

export namespace QuotaQueryChanges {
  /** @see https://www.rfc-editor.org/info/rfc9425/#section-4.5 */
  export interface Input extends MethodQueryChanges.Input<Quota, QuotaFilter> {}

  export interface Output extends MethodQueryChanges.Output {}

  export interface Contract {
    input: Input;
    output: Output;
  }
}
