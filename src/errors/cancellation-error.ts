import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An error used when a batch result is cancelled
 */
export class CancellationError extends JsonMetaError {
  override name = "CancellationError";
}

export function isCancellationError(input: unknown): input is CancellationError {
  return input instanceof CancellationError;
}
