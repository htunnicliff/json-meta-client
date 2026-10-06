import * as builtInCapabilities from "../capabilities/index.ts";
import { ConfigurationError } from "./configuration-error.ts";

/**
 * An error for capabilities in a client that are invalid
 */
export class CapabilityConfigurationError extends ConfigurationError {
  override name = "CapabilityConfigurationError";

  /**
   * The supplied capability
   */
  readonly givenCapability: unknown;

  /**
   * Available built-in capabilities accessible via string keys
   */
  get availableBuiltIns(): readonly string[] {
    return Object.keys(builtInCapabilities);
  }

  constructor(message: string, options: { capability: unknown }) {
    super(message);
    this.givenCapability = options.capability;
  }
}

export function isCapabilityConfigurationError(
  input: unknown,
): input is CapabilityConfigurationError {
  return input instanceof CapabilityConfigurationError;
}
