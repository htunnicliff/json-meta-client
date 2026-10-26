declare namespace JMAP {
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

  export interface BlobUploadObject {
    data: DataSourceObject[];
    type?: string;
  }

  export interface BlobUploadArguments extends SetArguments<BlobUploadParams> {
    accountId: string;
    create?: Record<string, BlobUploadParams>;
  }

  export interface BlobUploadResponse extends SetResponse<UploadObject, BlobUploadArguments> {}

  export interface BlobGetProperties {
    "data:asText"?: string;
    "data:asBase64"?: string;
    data?: string;
    [`digest:${string}`]: string;
    size: number;
  }

  export interface Blob {
    "data:asText": string | null;
    "data:asBase64": string;
    [`digest:${string}`]: string;
    isEncodingProblem: boolean;
    isTruncated: boolean;
    size: number;
  }

  export interface BlobGetArguments extends GetArguments<BlobGetProperties> {
    offset?: number;
    length?: number;
  }

  export interface BlobGetResponse extends GetResponse<Blob, BlobGetArguments> {}

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
