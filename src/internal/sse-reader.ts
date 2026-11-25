const byteOrderMark = String.fromCodePoint(0xfeff);

/**
 * What an event stream says, in the order it says it
 */
export type EventStreamItem =
  /** An event, dispatched by a blank line after one or more `data` lines */
  | { type: "message"; event: string; data: string; lastEventId: string }
  /** A blank line that changed the last event ID without dispatching an event */
  | { type: "id"; lastEventId: string }
  /** A `retry` field: the reconnection time, in milliseconds */
  | { type: "retry"; milliseconds: number };

/**
 * Parse decoded text from an event stream, as the WHATWG HTML standard's
 * "event stream interpretation" defines it. Lines end with CRLF, LF or CR,
 * and may be split across chunks anywhere, including between a CR and its
 * LF. A final event that no blank line ends is never dispatched.
 *
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation
 */
export async function* parseEventStream(
  chunks: AsyncIterable<string>,
): AsyncGenerator<EventStreamItem> {
  const state: ParserState = { data: "", event: "", lastEventId: "", dispatchedId: "" };
  let line = "";
  let started = false;
  // A CR ended the previous chunk, so an LF at the start of this one is
  // part of the same line ending
  let skipLeadingLF = false;

  for await (let chunk of chunks) {
    if (!started && chunk.length > 0) {
      started = true;
      if (chunk.startsWith(byteOrderMark)) {
        chunk = chunk.slice(1);
      }
    }
    let start = 0;
    if (skipLeadingLF && chunk.length > 0) {
      skipLeadingLF = false;
      if (chunk.startsWith("\n")) {
        start = 1;
      }
    }
    for (let index = start; index < chunk.length; index++) {
      const character = chunk[index];
      if (character !== "\r" && character !== "\n") {
        continue;
      }
      const item = processLine(state, line + chunk.slice(start, index));
      line = "";
      if (character === "\r") {
        if (index + 1 === chunk.length) {
          skipLeadingLF = true;
        } else if (chunk[index + 1] === "\n") {
          index++;
        }
      }
      start = index + 1;
      if (item) {
        yield item;
      }
    }
    line += chunk.slice(start);
  }
}

interface ParserState {
  data: string;
  event: string;
  lastEventId: string;
  /** The last event ID that was reported */
  dispatchedId: string;
}

/**
 * Process one line of an event stream, returning what it reports, if
 * anything
 */
function processLine(state: ParserState, line: string): EventStreamItem | undefined {
  if (line === "") {
    return dispatch(state);
  }
  if (line.startsWith(":")) {
    // A comment
    return undefined;
  }
  const colon = line.indexOf(":");
  const field = colon === -1 ? line : line.slice(0, colon);
  let value = colon === -1 ? "" : line.slice(colon + 1);
  if (value.startsWith(" ")) {
    value = value.slice(1);
  }
  switch (field) {
    case "data":
      state.data += `${value}\n`;
      return undefined;
    case "event":
      state.event = value;
      return undefined;
    case "id":
      if (!value.includes("\0")) {
        state.lastEventId = value;
      }
      return undefined;
    case "retry":
      return /^\d+$/.test(value) ? { type: "retry", milliseconds: Number(value) } : undefined;
    default:
      return undefined;
  }
}

/**
 * Dispatch the buffered event at a blank line
 */
function dispatch(state: ParserState): EventStreamItem | undefined {
  const { lastEventId } = state;
  const idChanged = lastEventId !== state.dispatchedId;
  state.dispatchedId = lastEventId;
  if (state.data === "") {
    state.event = "";
    return idChanged ? { type: "id", lastEventId } : undefined;
  }
  const item: EventStreamItem = {
    type: "message",
    event: state.event || "message",
    data: state.data.slice(0, -1),
    lastEventId,
  };
  state.data = "";
  state.event = "";
  return item;
}
