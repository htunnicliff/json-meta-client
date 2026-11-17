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

export const defaultTimelineOptions: TimelineOptions = {
  sessions: true,
  requestBodies: true,
  responses: true,
  lineNumbers: true,
  callLabels: true,
  clipLong: true,
};

/** The options' labels in the panel's menu */
export const timelineOptionLabels: Record<keyof TimelineOptions, string> = {
  sessions: "Session requests",
  requestBodies: "Request bodies",
  responses: "Responses",
  lineNumbers: "Line numbers",
  callLabels: "Method call labels",
  clipLong: "Clip long bodies",
};

/** The options, in menu order */
export const timelineOptionKeys = Object.keys(defaultTimelineOptions).filter(isOption);

const STORAGE_KEY = "json-meta-client:playground:timeline";

/**
 * The options last chosen in this browser, over the defaults
 */
export function loadTimelineOptions(): TimelineOptions {
  const options = { ...defaultTimelineOptions };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    if (typeof stored !== "object" || stored === null) return options;
    for (const [key, value] of Object.entries(stored)) {
      if (isOption(key) && typeof value === "boolean") options[key] = value;
    }
  } catch {
    // Storage can be unavailable, or hold something else; the defaults stand
  }
  return options;
}

function isOption(key: string): key is keyof TimelineOptions {
  return Object.hasOwn(defaultTimelineOptions, key);
}

export function saveTimelineOptions(options: TimelineOptions): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
  } catch {
    // Storage can be unavailable, as in a private window; the options last the visit
  }
}
