import type { Capability } from "../capability.ts";

export function mapEntitiesToUrns(capabilities: Iterable<Capability>): Record<string, string[]> {
  const entityToUrns: Record<string, string[]> = Object.create(null);

  for (const { urn, entities } of capabilities) {
    for (const entity of entities) {
      const urns = (entityToUrns[entity] ??= []);
      if (!urns.includes(urn)) {
        urns.push(urn);
      }
    }
  }

  return entityToUrns;
}
