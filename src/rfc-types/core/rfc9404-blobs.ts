/**
 * Copyright (c) 2026 Hunter Tunnicliff
 *
 * This source code is subject to the terms of the Mozilla Public
 * License, version 2.0. If a copy of the MPL was not distributed with this
 * file, you can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { FileUpload, SetError } from "./rfc8620-jmap.ts";

declare module "../extensions.ts" {
  export interface SessionCapabilities {
    "urn:ietf:params:jmap:blob": {};
  }

  export interface AccountCapabilities {
    "urn:ietf:params:jmap:blob": {
      maxSizeBlobSet: number | null;
      maxDataSources: number;
      supportedTypeNames: string[];
      supportedDigestAlgorithms: string[];
    };
  }
}

export type DataSourceObject =
  | { "data:asText": string }
  | { "data:asBase64": string }
  | { blobId: string; offset?: number | null; length?: number };

export interface UploadObject {
  data: DataSourceObject[];
  type?: string | null;
}

export namespace BlobUpload {
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

export interface UploadedBlob {
  id: FileUpload.Result["blobId"];
  type: string | null;
  size: FileUpload.Result["size"];
}

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
  export interface Input {
    accountId: string;
    ids: readonly string[];
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

export type BlobGetProperties =
  | "data"
  | "data:asText"
  | "data:asBase64"
  | "size"
  | `digest:${string}`;

export namespace BlobLookup {
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

export interface BlobInfo {
  id: string;
  matchedIds: {
    [typeName: string]: string[];
  };
}
