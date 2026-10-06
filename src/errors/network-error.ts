import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An error occurring at the network level.
 *
 * This is not used for HTTP errors, as those
 * are represented by `HttpError`.
 */
export class NetworkError extends JsonMetaError {
  override name = "NetworkError";

  constructor(message: string, options: { cause: unknown; request: Request | undefined }) {
    super(message);
    this.cause = options.cause;
    this.request = options.request;
  }

  /**
   * The request that was sent, if available
   */
  readonly request: Request | undefined;
}

export function isNetworkError(input: unknown): input is NetworkError {
  return input instanceof NetworkError;
}
