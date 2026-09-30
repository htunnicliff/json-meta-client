import type { Invocation, ProblemDetails } from "jmap-rfc-types";

export interface JmapRequestContext {
  readonly url: string;
  readonly method: string;
}

export class JmapClientError extends Error {
  readonly kind: string;

  constructor(message: string, kind: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "JmapClientError";
    this.kind = kind;
  }
}

export class JmapConfigurationError extends JmapClientError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, "configuration", options);
    this.name = "JmapConfigurationError";
  }
}

export class JmapTransportError extends JmapClientError {
  readonly request: JmapRequestContext;

  constructor(message: string, request: JmapRequestContext, cause: unknown) {
    super(message, "transport", { cause });
    this.name = "JmapTransportError";
    this.request = request;
  }
}

export interface JmapResponseContext {
  request?: JmapRequestContext;
  response?: Response;
  payload?: unknown;
  methodCall?: Invocation;
  cause?: unknown;
}

export class JmapProtocolError extends JmapClientError {
  readonly request?: JmapRequestContext;
  readonly response?: Response;
  readonly payload?: unknown;
  readonly methodCall?: Invocation;

  constructor(message: string, context: JmapResponseContext = {}) {
    super(message, "protocol", { cause: context.cause });
    this.name = "JmapProtocolError";
    this.request = context.request;
    this.response = context.response;
    this.payload = context.payload;
    this.methodCall = context.methodCall;
  }
}

export class JmapHttpError extends JmapClientError {
  readonly status: number;
  readonly response: Response;
  readonly request: JmapRequestContext;
  readonly payload: unknown;

  constructor(response: Response, request: JmapRequestContext, payload?: unknown, cause?: unknown) {
    super(`JMAP request failed (${response.status})`, "http", { cause: cause ?? payload });
    this.name = "JmapHttpError";
    this.status = response.status;
    this.response = response;
    this.request = request;
    this.payload = payload;
  }
}

export class JmapError extends JmapClientError implements ProblemDetails {
  readonly type: string;
  readonly description?: string;
  readonly detail?: string;
  readonly instance?: string;
  readonly limit?: string;
  readonly methodCallId?: string;
  readonly status?: number;
  readonly details: ProblemDetails & Record<string, unknown>;
  readonly methodCall?: Invocation;

  constructor(message: string, cause: unknown, methodCall?: Invocation) {
    super(message, "method", { cause });
    this.name = "JmapError";
    if (!JmapError.isProblemDetails(cause)) {
      throw new JmapConfigurationError("Invalid JMAP error cause", { cause });
    }
    this.type = cause.type;
    this.detail = cause.detail;
    this.instance = cause.instance;
    this.limit = cause.limit;
    this.methodCallId = methodCall?.[2] ?? cause.methodCallId;
    this.status = cause.status;
    this.description = typeof cause.description === "string" ? cause.description : undefined;
    this.details = cause;
    this.methodCall = methodCall;
  }

  static isProblemDetails(input: unknown): input is ProblemDetails & Record<string, unknown> {
    return (
      typeof input === "object" &&
      input !== null &&
      !Array.isArray(input) &&
      "type" in input &&
      typeof input.type === "string"
    );
  }

  static isJmapError(input: unknown): input is JmapError {
    return input instanceof JmapError;
  }
}

export { JmapError as JmapMethodError };

export class JmapRequestLimitError extends JmapClientError {
  readonly limit: "maxCallsInRequest" | "maxSizeRequest" | "maxConcurrentRequests";
  readonly maximum: number;
  readonly actual: number;
  readonly methodCallIds: readonly string[];
  readonly request: JmapRequestContext;

  constructor(
    limit: "maxCallsInRequest" | "maxSizeRequest" | "maxConcurrentRequests",
    maximum: number,
    actual: number,
    methodCallIds: readonly string[],
    request: JmapRequestContext,
  ) {
    super(`JMAP request exceeds ${limit}: ${actual} exceeds ${maximum}`, "request-limit");
    this.limit = limit;
    this.maximum = maximum;
    this.actual = actual;
    this.methodCallIds = [...methodCallIds];
    this.request = request;
  }
}

export class JmapAbortError extends JmapClientError {
  readonly reason: unknown;

  constructor(reason?: unknown) {
    super("JMAP operation was aborted", "abort", { cause: reason });
    this.name = "AbortError";
    this.reason = reason;
  }
}
