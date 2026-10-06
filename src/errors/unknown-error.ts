import { JsonMetaError } from "./json-meta-error.ts";

export class UnknownError extends JsonMetaError {
  override name = "UnknownError";
}

export function isUnknownError(input: unknown): input is UnknownError {
  return input instanceof UnknownError;
}
