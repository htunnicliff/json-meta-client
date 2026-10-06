import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An error occurring within a state change listener
 */
export class StateChangeError extends JsonMetaError {
  override name = "StateChangeError";
}

export function isStateChangeError(input: unknown): input is StateChangeError {
  return input instanceof StateChangeError;
}
