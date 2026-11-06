import * as builtIns from "../../src/capabilities/index.ts";

export default {
  load() {
    return Object.fromEntries(
      Object.entries(builtIns).map(([name, { urn, entities }]) => [
        name,
        { urn, entities: [...entities] },
      ]),
    );
  },
};
