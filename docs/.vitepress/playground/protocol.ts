import type { RecordedRequest } from "../recorder/index.ts";

/**
 * The specifier that compiled code imports the library from. The run worker
 * replaces it with the URL of a module that re-exports the shimmed library.
 */
export const SHIM_SPECIFIER = "playground:json-meta-client";

/**
 * Messages between the playground page and its workers. The compiler worker
 * lives as long as the page; a fresh run worker runs each version of the code.
 */

export interface CompileRequest {
  id: number;
  source: string;
}

export interface Diagnostic {
  message: string;
  /** 1-based line and column, when the diagnostic has a location */
  line?: number;
  column?: number;
}

export type CompileResult =
  | { id: number; code: string }
  | { id: number; diagnostics: Diagnostic[] };

export interface RunRequest {
  /** The compiled module, importing the library through the shim specifier */
  code: string;
}

/**
 * What a run reports, in the order it happens
 */
export type RunEvent =
  /** A request the code made, with its position in send order */
  | { type: "request"; index: number; request: RecordedRequest }
  /**
   * No request has been made for a while, so the code is waiting for a
   * response or has finished. More requests may follow, for example from a
   * timer.
   */
  | { type: "idle"; finished: boolean }
  | { type: "error"; message: string };
