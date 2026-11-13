// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { EmptyCapabilityDetails, PatchObject, SetError } from "../core/index.ts";
import type { EmailUpdate } from "./rfc8621-mail.ts";

/** Server-wide details for `urn:ietf:params:jmap:mdn`. */
export type MdnSessionCapabilities = EmptyCapabilityDetails;

/** Per-account details for `urn:ietf:params:jmap:mdn`. */
export type MdnAccountCapabilities = EmptyCapabilityDetails;

/** @see https://www.rfc-editor.org/info/rfc9007/#section-2 */
export interface Disposition {
  actionMode: "manual-action" | "automatic-action";
  sendingMode: "mdn-sent-manually" | "mdn-sent-automatically";
  type: "deleted" | "dispatched" | "displayed" | "processed";
}

/** @see https://www.rfc-editor.org/info/rfc9007/#section-2 */
export interface MDN {
  /** May be omitted or null when parsing cannot identify the original Email. */
  forEmailId?: string | null;
  subject: string | null;
  textBody: string | null;
  includeOriginalMessage: boolean;
  reportingUA: string | null;
  disposition: Disposition;
  mdnGateway: string | null;
  originalRecipient: string | null;
  finalRecipient: string | null;
  originalMessageId: string | null;
  error: string[] | null;
  extensionFields: Record<string, string> | null;
}

/** @see https://www.rfc-editor.org/info/rfc9007/#section-2.1 */
export type WritableMDN = Pick<MDN, "disposition"> &
  Partial<
    Pick<
      MDN,
      | "subject"
      | "textBody"
      | "includeOriginalMessage"
      | "reportingUA"
      | "finalRecipient"
      | "extensionFields"
    >
  > & {
    forEmailId: string;
    mdnGateway?: never;
    originalRecipient?: never;
    originalMessageId?: never;
    error?: never;
  };

export namespace MDNSend {
  /** @see https://www.rfc-editor.org/info/rfc9007/#section-2.1 */
  export interface Input {
    accountId: string;
    identityId: string;
    send: Record<string, WritableMDN>;
    onSuccessUpdateEmail?: Record<string, PatchObject<EmailUpdate>> | null;
  }
  export interface Output {
    accountId: string;
    sent?: Record<string, Partial<MDN>> | null;
    notSent?: Record<string, SetError> | null;
  }
  export interface Contract {
    input: Input;
    output: Output;
  }
}

export namespace MDNParse {
  /** @see https://www.rfc-editor.org/info/rfc9007/#section-2.2 */
  export interface Input {
    accountId: string;
    blobIds: string[];
  }
  export interface Output {
    accountId: string;
    parsed?: Record<string, MDN> | null;
    notParsable?: string[] | null;
    notFound?: string[] | null;
  }
  export interface Contract {
    input: Input;
    output: Output;
  }
}
