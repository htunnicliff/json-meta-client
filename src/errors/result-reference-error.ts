import type { MethodCall } from "../internal/method-call.ts";
import { JsonMetaError } from "./json-meta-error.ts";

const messages = {
  nested: "a result reference must be a top-level argument",
  "duplicate-argument": "an argument is given both as a value and as a result reference",
  "cross-batch": "a result reference must name an earlier method call in the same batch",
  "duplicate-id": "another method call in the same batch has the same ID",
} as const;

/**
 * Which RFC 8620 §3.7 result reference rule a method call breaks
 */
export type ResultReferenceErrorReason = keyof typeof messages;

/**
 * An error for a method call that breaks a result reference rule. The client
 * rejects it without sending it, and the rest of its batch proceeds.
 */
export class ResultReferenceError extends JsonMetaError {
  override name = "ResultReferenceError";

  constructor(reason: ResultReferenceErrorReason, methodCall: MethodCall<object>) {
    super(`Cannot send ${methodCall.method}: ${messages[reason]}`);
    this.reason = reason;
    this.methodCall = methodCall;
  }

  readonly reason: ResultReferenceErrorReason;

  /**
   * The rejected method call
   */
  readonly methodCall: MethodCall<object>;
}

export function isResultReferenceError(input: unknown): input is ResultReferenceError {
  return input instanceof ResultReferenceError;
}
