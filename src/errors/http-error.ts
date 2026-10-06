import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An error involving a 4xx or 5xx HTTP request
 */
export class HttpError extends JsonMetaError {
  override name = "HttpError";

  constructor(
    message: string,
    options: {
      request: Request;
      response: Response;
      responseData?: unknown;
      cause?: unknown;
    },
  ) {
    super(message, { cause: options.cause });
    this.request = options.request;
    this.response = options.response;
    this.responseData = options.responseData;
  }

  readonly request: Request;
  readonly response: Response;
  readonly responseData: unknown;

  get status(): number {
    return this.response.status;
  }
}

export function isHttpError(input: unknown): input is HttpError {
  return input instanceof HttpError;
}
