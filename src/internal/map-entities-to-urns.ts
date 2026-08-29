import type { Capability } from "../capability.ts";

export function mapEntitiesToUrns(
  capabilities: Iterable<Capability<string>>,
): Record<string, string> {
  const entityToUrn: Record<string, string> = {};

  for (const { urn, entities } of capabilities) {
    for (const entity of entities) {
      if (Object.hasOwn(entityToUrn, entity)) {
        throw new Error(`Entity "${entity}" has already been added`);
      }
      entityToUrn[entity] = urn;
    }
  }

  return entityToUrn;
}
