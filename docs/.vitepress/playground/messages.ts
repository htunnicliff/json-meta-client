import type { RecordedRequest } from "../recorder/index.ts";

/**
 * A message the playground worker posts while running user code
 */
export type RunnerMessage =
  | { type: "request"; request: RecordedRequest }
  | { type: "waiting" }
  | { type: "error"; message: string };
