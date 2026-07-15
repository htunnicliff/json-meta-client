import type { ProblemDetails, RequestErrorProblemType } from "jmap-rfc-types";

export class JmapError extends Error implements ProblemDetails {
  readonly name = "JmapError";
  readonly type: string | RequestErrorProblemType;
  readonly detail?: string;
  readonly instance?: string;
  readonly limit?: string;
  readonly methodCallId?: string;
  readonly status?: number;

  constructor(message: string, cause: unknown) {
    super(message, { cause });
    if (JmapError.isProblemDetails(cause)) {
      this.type = cause.type;
      this.detail = cause.detail;
      this.instance = cause.instance;
      this.limit = cause.limit;
      this.methodCallId = cause.methodCallId;
      this.status = cause.status;
    } else {
      throw new Error("Invalid JMAP error cause");
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
