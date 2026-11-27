import type { MethodCall } from "../internal/method-call.ts";
import { JsonMetaError } from "./json-meta-error.ts";

const messages = {
  "unknown-id": "the call doesn't create an object with this creation ID",
  "batch-sent": "the call's batch was already sent, so a later call can't use this creation ID",
  "duplicate-id": "an earlier call in the same batch already uses this creation ID",
} as const;

/**
 * Which RFC 8620 §5.3 creation ID rule a call breaks
 */
export type CreationReferenceErrorReason = keyof typeof messages;

/**
 * An error for a creation ID that can't be referenced safely. `createdRef()`
 * throws it for an unknown creation ID, or once its call's batch was sent.
 * A call that reuses a creation ID from an earlier call in the same batch
 * rejects with it without being sent, and the rest of its batch proceeds.
 */
export class CreationReferenceError extends JsonMetaError {
  override name = "CreationReferenceError";

  constructor(
    reason: CreationReferenceErrorReason,
    methodCall: MethodCall<object>,
    creationId: string,
  ) {
    super(`Cannot use creation ID "${creationId}" of ${methodCall.method}: ${messages[reason]}`);
    this.reason = reason;
    this.methodCall = methodCall;
    this.creationId = creationId;
  }

  readonly reason: CreationReferenceErrorReason;

  /**
   * The call that creates, or would create, the object
   */
  readonly methodCall: MethodCall<object>;

  /**
   * The creation ID
   */
  readonly creationId: string;
}

export function isCreationReferenceError(input: unknown): input is CreationReferenceError {
  return input instanceof CreationReferenceError;
}
