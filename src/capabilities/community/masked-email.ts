// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { Capability } from "../../capability.ts";
import type { MethodGet, MethodSet } from "../../rfc-types/core/index.ts";

type MaskedEmailState = "pending" | "enabled" | "disabled" | "deleted";

export interface MaskedEmail {
  id: string;
  email: string;
  state: MaskedEmailState;
  forDomain: string;
  description: string;
  lastMessageAt: string | null;
  createdAt: string;
  createdBy: string;
  url: string | null;
  // emailPrefix: String (create-only)
}

export declare namespace MaskedEmailContracts {
  export namespace Get {
    export type Input = MethodGet.Input<MaskedEmail>;
    export type Output<A> = MethodGet.Output<MaskedEmail, A>;
    export interface Contract {
      input: Input;
      output: Output<this["input"]>;
    }
  }

  export namespace Set {
    export type Input = MethodSet.Input<
      MaskedEmail,
      Partial<Omit<MaskedEmail, "id"> & { emailPrefix: string }>
    >;
    export type Output = MethodSet.Output<MaskedEmail>;
    export interface Contract {
      input: Input;
      output: Output;
    }
  }
}

export const maskedEmail: Capability<
  "MaskedEmail",
  {
    MaskedEmail: {
      get: MaskedEmailContracts.Get.Contract;
      set: MaskedEmailContracts.Set.Contract;
    };
  },
  "https://www.fastmail.com/dev/maskedemail"
> = {
  urn: "https://www.fastmail.com/dev/maskedemail",
  entities: ["MaskedEmail"],
};
