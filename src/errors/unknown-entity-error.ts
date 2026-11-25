import { JsonMetaError } from "./json-meta-error.ts";

/**
 * An error for an API call on an entity that no configured capability declares
 */
export class UnknownEntityError extends JsonMetaError {
  override name = "UnknownEntityError";

  /**
   * The entity that no capability declares
   */
  readonly entity: string;

  /**
   * The method that was called on the entity
   */
  readonly method: string;

  constructor(options: { entity: string; method: string }) {
    super(
      `Cannot call ${options.entity}/${options.method}: no configured capability declares the entity "${options.entity}". ` +
        `Add a capability that declares it to \`capabilities\`, using a built-in capability or \`defineCapability\`.`,
    );
    this.entity = options.entity;
    this.method = options.method;
  }
}

export function isUnknownEntityError(input: unknown): input is UnknownEntityError {
  return input instanceof UnknownEntityError;
}
