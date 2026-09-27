import type { GetArguments, GetResponse, SetArguments, SetResponse, UTCDate } from "jmap-rfc-types";

import { defineCapability } from "../../capability.ts";

type MaskedEmailState = "pending" | "enabled" | "disabled" | "deleted";

export interface MaskedEmail {
  id: string;
  email: string;
  state: MaskedEmailState;
  forDomain: string;
  description: string;
  lastMessageAt: UTCDate | null;
  createdAt: UTCDate;
  createdBy: string;
  url: string | null;
  // emailPrefix: String (create-only)
}

export declare namespace MaskedEmailContracts {
  export namespace Get {
    export type Input = GetArguments<MaskedEmail>;
    export type Output<A> = GetResponse<MaskedEmail, A>;
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export namespace Set {
    export type Input = SetArguments<MaskedEmail & { emailPrefix: string }>;
    export type Output<A> = SetResponse<MaskedEmail, A>;
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }
}

export const maskedemail = defineCapability({
  urn: "https://www.fastmail.com/dev/maskedemail",
  entities: ["MaskedEmail"],
}).withMethods<{
  MaskedEmail: {
    get: MaskedEmailContracts.Get.Contract;
    set: MaskedEmailContracts.Set.Contract;
  };
}>();
