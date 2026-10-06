import type { MethodCall } from "../internal/method-calls.ts";
import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An unexpected error associated with a specific method call
 */
export class MethodCallError extends JsonMetaError {
  override name = "MethodCallError";

  constructor(
    message: string,
    options: {
      methodCall: MethodCall<unknown>;
      responseData?: unknown;
    },
  ) {
    super(message);
    this.methodCall = options.methodCall;
    this.responseData = options.responseData;
  }

  /**
   * The given method call sent in a request
   */
  readonly methodCall: MethodCall<unknown>;

  /**
   * The response body, if it exists
   */
  readonly responseData: unknown;
}

export function isMethodCallError(input: unknown): input is MethodCallError {
  return input instanceof MethodCallError;
}
