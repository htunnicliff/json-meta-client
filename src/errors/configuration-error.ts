import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An error for client misconfiguration
 */
export class ConfigurationError extends JsonMetaError {
  override name = "ConfigurationError";
}

export function isConfigurationError(input: unknown): input is ConfigurationError {
  return input instanceof ConfigurationError;
}
