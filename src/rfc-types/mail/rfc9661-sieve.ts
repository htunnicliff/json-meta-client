// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { MethodGet, MethodQuery, MethodSet, SetError } from "../core/index.ts";

declare module "../extensions.ts" {
  export interface SessionCapabilities {
    "urn:ietf:params:jmap:sieve": {
      implementation: string;
    };
  }

  export interface AccountCapabilities {
    "urn:ietf:params:jmap:sieve": {
      maxSizeScriptName: number;
      maxSizeScript: number | null;
      maxNumberScripts: number | null;
      maxNumberRedirects: number | null;
      sieveExtensions: string[];
      notificationMethods: string[] | null;
      externalLists: string[] | null;
    };
  }
}

/** @see https://www.rfc-editor.org/info/rfc9661/#section-2.1 */
export interface SieveScript {
  id: string;
  name: string | null;
  blobId: string;
  isActive: boolean;
}

export namespace SieveScriptGet {
  /** @see https://www.rfc-editor.org/info/rfc9661/#section-2.3 */
  export interface Input extends MethodGet.Input<SieveScript> {}
  export interface Output<Args> extends MethodGet.Output<SieveScript, Args> {}
  export interface Contract {
    input: Input;
    output: Output<this["input"]>;
  }
}

/** @see https://www.rfc-editor.org/info/rfc9661/#section-2.4 */
export type WritableSieveScript = Pick<SieveScript, "blobId"> &
  Partial<Pick<SieveScript, "name">> & {
    id?: never;
    isActive?: never;
  };

export namespace SieveScriptSet {
  /** @see https://www.rfc-editor.org/info/rfc9661/#section-2.4 */
  export interface Input extends MethodSet.Input<
    SieveScript,
    WritableSieveScript,
    WritableSieveScript
  > {
    onSuccessActivateScript?: string;
    onSuccessDeactivateScript?: boolean;
  }
  export interface Output extends MethodSet.Output<SieveScript> {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc9661/#section-2.5 */
export interface SieveScriptFilter {
  name?: string;
  isActive?: boolean;
}

export namespace SieveScriptQuery {
  /** @see https://www.rfc-editor.org/info/rfc9661/#section-2.5 */
  export interface Input extends MethodQuery.Input<SieveScript, SieveScriptFilter> {}
  export interface Output extends MethodQuery.Output {}
  export interface Contract {
    input: Input;
    output: Output;
  }
}

export namespace SieveScriptValidate {
  /** @see https://www.rfc-editor.org/info/rfc9661/#section-2.6 */
  export interface Input {
    accountId: string;
    blobId: string;
  }
  export interface Output {
    accountId: string;
    error: SetError | null;
  }
  export interface Contract {
    input: Input;
    output: Output;
  }
}
