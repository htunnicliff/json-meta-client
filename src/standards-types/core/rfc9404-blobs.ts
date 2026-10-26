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

  export namespace BlobUpload {
    export interface Input {
      accountId: string;
      create: Record<string, FileUpload.Params>;
    }

    export interface Output {
      accountId: string;
      created: Record<string, UploadedBlob>;
      notCreated: Record<string, SetError> | null;
    }

    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export interface UploadedBlob {
    id: FileUpload.Result["blobId"];
    type: FileUpload.Result["type"];
    size: FileUpload.Result["size"];
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

  export namespace BlobGet {
    export interface Input {
      accountId: string;
      ids?: readonly string[];
      properties?: readonly BlobGetProperties[];
      offset?: number;
      length?: number;
    }

    export interface Output {
      accountId: string;
      state: string;
      list: ReadonlyArray<Blob>;
      notFound: ReadonlyArray<string>;
    }

    export interface Contract {
      input: Input;
      output: Output;
    }
  }

  export type BlobGetProperties = {
    "data:asText"?: string;
    "data:asBase64"?: string;
    data?: string;
    size: number;
  } & {
    [key in `digest:${string}`]: string;
  };

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
}
