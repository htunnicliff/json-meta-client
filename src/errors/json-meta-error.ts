export class JsonMetaError extends Error {
  override name = "JsonMetaError";
}

export function isJsonMetaError(input: unknown): input is JsonMetaError {
  return input instanceof JsonMetaError;
}
