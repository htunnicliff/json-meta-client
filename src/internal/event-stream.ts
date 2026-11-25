import { StateChangeError } from "../errors/index.ts";
import type { Session } from "../rfc-types/core/index.ts";
import type { PushEvents } from "../transports/types.ts";
import { disposable } from "./disposable.ts";
import type { DisposeFallback } from "./disposable.ts";
import { expandURITemplate } from "./expand-uri-template.ts";
import type { HttpClient } from "./http.ts";
import { isStateChange } from "./read-state-changes.ts";

/**
 * Open the session's event stream, the push channel used when the transport
 * provides none
 */
export async function openEventStream(
  http: HttpClient,
  session: Session,
  events: PushEvents,
  pingSeconds: number,
): Promise<Disposable & DisposeFallback> {
  const url = expandURITemplate(session.eventSourceUrl, {
    types: "*",
    // spellchecker:disable-next-line
    closeafter: "no",
    ping: pingSeconds.toFixed(0),
  });
  const { createEventSource } = await import("eventsource-client");

  const eventSource = createEventSource({
    url,
    fetch: async (url, options) => {
      const requestOptions: RequestInit = options ?? {};
      try {
        return (await http.fetch(url, requestOptions, true)).response;
      } catch (cause) {
        if (!requestOptions.signal?.aborted) {
          events.onError(new StateChangeError("Event-stream connection failed", { cause }));
        }
        throw cause;
      }
    },
    onMessage: (event) => {
      let message: unknown;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        events.onError(
          new StateChangeError(
            error instanceof Error
              ? error.message
              : "An error occurred when parsing a state change message payload",
            { cause: error },
          ),
        );
        return;
      }
      if (isStateChange(message)) {
        events.onStateChange(message);
      }
    },
  });
  return disposable(() => eventSource.close());
}
