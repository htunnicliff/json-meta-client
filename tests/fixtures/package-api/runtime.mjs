import * as root from "json-meta-client";
import * as capabilities from "json-meta-client/capabilities";
import * as community from "json-meta-client/capabilities/community";

export const surfaces = {
  root: Object.keys(root).toSorted(),
  capabilities: Object.keys(capabilities).toSorted(),
  community: Object.keys(community).toSorted(),
};

export const constructorNames = Object.fromEntries(
  Object.entries(root)
    .filter(([name]) => name === "Client" || name.startsWith("Jmap"))
    .map(([name, value]) => [name, value.name]),
);

export const coreUrn = capabilities.core.urn;
export const communityUrn = community.maskedEmail.urn;
export const configurable = root.defineCapability({ urn: "test:packed", entities: ["Example"] });
