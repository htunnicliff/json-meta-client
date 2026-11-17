import type { OptionSet } from "./stored-options.ts";

/**
 * Which parts of the timeline the request panel shows
 */
export interface TimelineOptions {
  /** Session fetches, as steps of their own */
  sessions: boolean;
  /** The bodies of requests, such as each JMAP Request */
  requestBodies: boolean;
  /** Responses: placeholder Sessions, and everything from a connected server */
  responses: boolean;
  /** Line numbers in JSON */
  lineNumbers: boolean;
  /** Labels of method calls and their result references in JMAP Requests */
  callLabels: boolean;
  /** Long bodies cut to a few lines until expanded */
  clipLong: boolean;
}

/**
 * The request panel's options
 */
export const timelineOptions: OptionSet<TimelineOptions> = {
  defaults: {
    sessions: true,
    requestBodies: true,
    responses: true,
    lineNumbers: true,
    callLabels: true,
    clipLong: true,
  },
  labels: {
    sessions: "Session requests",
    requestBodies: "Request bodies",
    responses: "Responses",
    lineNumbers: "Line numbers",
    callLabels: "Method call labels",
    clipLong: "Clip long bodies",
  },
  storageKey: "json-meta-client:playground:timeline",
};
