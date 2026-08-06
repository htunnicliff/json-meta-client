import { Capability, defineCapability } from "../capability.ts";

const Core = defineCapability({
  urn: "urn:ietf:params:jmap:core",
  entities: ["Core"],
}).withMethods<{
  Core: {
    get: <Args extends Record<string, any>>(args: Args) => Args;
  };
}>();
