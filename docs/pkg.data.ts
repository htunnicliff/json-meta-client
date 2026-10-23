/// <reference types="node" />
import pkg from "../package.json" with { type: "json" };

export default {
  load() {
    return pkg;
  },
};
