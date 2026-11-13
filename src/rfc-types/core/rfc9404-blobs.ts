// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { FileUpload, SetError } from "./rfc8620-jmap.ts";

/**
 * Account limits and features advertised by the JMAP Blob capability.
 *
 * @see https://www.rfc-editor.org/rfc/rfc9404.html#section-3.1
 */
export interface BlobAccountCapabilities {
  maxSizeBlobSet: number | null;
  maxDataSources: number;
  supportedTypeNames: string[];
  supportedDigestAlgorithms: string[];
}

/** @see https://www.rfc-editor.org/info/rfc9404/#section-4.1 */
export type DataSourceObject =
  | {
      "data:asText": string | null;
      "data:asBase64"?: never;
      blobId?: never;
      offset?: never;
      length?: never;
    }
  | {
      "data:asBase64": string | null;
      "data:asText"?: never;
      blobId?: never;
      offset?: never;
      length?: never;
    }
  | {
      blobId: string;
      offset?: number | null;
      length?: number | null;
      "data:asText"?: never;
      "data:asBase64"?: never;
    };

/** @see https://www.rfc-editor.org/info/rfc9404/#section-4.1 */
export interface UploadObject {
  data: DataSourceObject[];
  type?: string | null;
}

export namespace BlobUpload {
  /** @see https://www.rfc-editor.org/info/rfc9404/#section-4.1 */
  export interface Input {
    accountId: string;
    create: Record<string, UploadObject>;
  }

  export interface Output {
    accountId: string;
    created?: Record<string, UploadedBlob> | null;
    notCreated?: Record<string, SetError> | null;
  }

  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc9404/#section-4.1 */
export interface UploadedBlob {
  id: FileUpload.Result["blobId"];
  type: string | null;
  size: FileUpload.Result["size"];
}

/** @see https://www.rfc-editor.org/info/rfc9404/#section-4.2 */
export type Blob = {
  id: string;
  "data:asText"?: string | null;
  "data:asBase64"?: string;
  isEncodingProblem?: boolean;
  isTruncated?: boolean;
  size?: number;
} & {
  [key in `digest:${string}`]?: string;
};

export namespace BlobGet {
  /** @see https://www.rfc-editor.org/info/rfc9404/#section-4.2 */
  export interface Input {
    accountId: string;
    ids?: readonly string[] | null;
    properties?: readonly BlobGetProperties[] | null;
    offset?: number | null;
    length?: number | null;
  }

  export interface Output {
    accountId: string;
    list: ReadonlyArray<Blob>;
    notFound: ReadonlyArray<string>;
  }

  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc9404/#section-4.2 */
export type BlobGetProperties =
  | "data"
  | "data:asText"
  | "data:asBase64"
  | "size"
  | `digest:${string}`;

export namespace BlobLookup {
  /** @see https://www.rfc-editor.org/info/rfc9404/#section-4.3 */
  export interface Input {
    accountId: string;
    typeNames: string[];
    ids: string[];
  }

  export interface Output {
    list: BlobInfo[];
  }

  export interface Contract {
    input: Input;
    output: Output;
  }
}

/** @see https://www.rfc-editor.org/info/rfc9404/#section-4.3 */
export interface BlobInfo {
  id: string;
  matchedIds: {
    [typeName: string]: string[];
  };
}
