declare module "./index.ts" {
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

  export type DataSourceObject =
    | { "data:asText": string }
    | { "data:asBase64": string }
    | { blobId: string; offset?: number; length?: number };

  export interface UploadObject {
    data: DataSourceObject[];
    type?: string;
  }

  export interface BlobUploadMethodArguments {
    accountId: string;
    create: Record<string, BlobUploadParams>;
  }

  interface UploadedBlob {
    id: BlobUploadResponse["blobId"];
    type: BlobUploadResponse["type"];
    size: BlobUploadResponse["size"];
  }

  export interface BlobUploadMethodResponse {
    accountId: string;
    created: Record<string, UploadedBlob>;
    notCreated: Record<string, SetError> | null;
  }

  export type Blob = {
    "data:asText": string | null;
    "data:asBase64": string;
    isEncodingProblem: boolean;
    isTruncated: boolean;
    size: number;
  } & {
    [key in `digest:${string}`]: string;
  };

  export type BlobGetProperties = {
    "data:asText"?: string;
    "data:asBase64"?: string;
    data?: string;
    size: number;
  } & {
    [key in `digest:${string}`]: string;
  };

  export interface BlobGetArguments {
    accountId: string;
    ids?: readonly string[];
    properties?: readonly BlobGetProperties[];
    offset?: number;
    length?: number;
  }

  export interface BlobGetResponse {
    accountId: string;
    state: string;
    list: ReadonlyArray<Blob>;
    notFound: ReadonlyArray<string>;
  }

  export interface BlobLookupArguments {
    accountId: string;
    typeNames: string[];
    ids: string[];
  }

  export interface BlobLookupResponse {
    list: BlobInfo[];
  }

  export interface BlobInfo {
    id: string;
    matchedIds: {
      [typeName: string]: string[];
    };
  }
}
