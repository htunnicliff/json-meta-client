import type { RecordedRequest, RecordedResponse } from "../recorder/index.ts";
import type { Trace } from "./tracer.ts";

/**
 * The specifier that compiled code imports the library from. The run worker
 * replaces it with the URL of a module that re-exports the shimmed library.
 */
export const SHIM_SPECIFIER = "playground:json-meta-client";

/**
 * The name the playground gives the user's code in diagnostics and source
 * locations
 */
export const FILE_NAME = "playground.ts";

/**
 * Messages between the playground page and its run workers. A fresh run
 * worker runs each version of the code.
 */

export interface Diagnostic {
  message: string;
  /** 1-based line and column, when the diagnostic has a location */
  line?: number;
  column?: number;
}

export interface RunRequest {
  /** The compiled module, importing the library through the shim specifier */
  code: string;
  /**
   * A real server to send requests to, instead of recording them only, and to
   * fill in the code's `<server>` and `<token>` placeholders with
   */
  connection?: Connection;
}

/**
 * A server the user connected, held in memory only
 */
export interface Connection {
  sessionUrl: string;
  /** A bearer token, or Basic credentials */
  auth: string | { username: string; password: string };
}

/**
 * What a run reports, in the order it happens
 */
export type RunEvent =
  /** A request the code made, with its position in send order */
  | { type: "request"; index: number; request: RecordedRequest }
  /** The response to the request at `index`: from a connected server, or a placeholder Session */
  | { type: "response"; index: number; response: RecordedResponse }
  /**
   * No request has been made for a while, so the code is waiting for a
   * response or has finished. More requests may follow, for example from a
   * timer.
   */
  | { type: "idle"; finished: boolean }
  | { type: "error"; message: string }
  /** Where the code made its calls and where it waits, sent before each `idle` */
  | { type: "trace"; trace: Trace }
  /** A `console` call, its arguments already formatted as text */
  | { type: "console"; level: ConsoleLevel; text: string };

export type ConsoleLevel = "log" | "info" | "warn" | "error" | "debug";
