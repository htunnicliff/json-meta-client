import type { ProblemDetails } from "jmap-rfc-types";

import type { MethodCall } from "../internal/method-call.ts";
import { JsonMetaError } from "./json-meta-error.ts";
import { UnknownError } from "./unknown-error.ts";

/**
 * An error received in response to a JMAP request
 */
export class JmapError extends JsonMetaError implements ProblemDetails {
  override readonly name = "JmapError";
  readonly type: string;
  readonly detail?: string;
  readonly instance?: string;
  readonly limit?: string;
  readonly methodCallId?: string;
  readonly status?: number;
  readonly methodCall?: MethodCall<unknown>;

  constructor(message: string, cause: unknown, options: { methodCall?: MethodCall<unknown> } = {}) {
    super(message, { cause });
    this.methodCall = options.methodCall;
    if (JmapError.isProblemDetails(cause)) {
      this.type = cause.type;
      this.detail = cause.detail;
      this.instance = cause.instance;
      this.limit = cause.limit;
      this.methodCallId = cause.methodCallId;
      this.status = cause.status;
    } else {
      throw new UnknownError(message, { cause });
    }
  }

  static isProblemDetails(input: unknown): input is ProblemDetails {
    return (
      typeof input === "object" &&
      input !== null &&
      "type" in input &&
      typeof input.type === "string"
    );
  }
}

export function isJmapError(input: unknown): input is JmapError {
  return input instanceof JmapError;
}
