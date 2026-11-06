/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { MethodGet, MethodChanges, MethodQuery, MethodQueryChanges } from "./rfc8620-jmap.ts";

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
  resourceType: QuotaResourceType;
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
