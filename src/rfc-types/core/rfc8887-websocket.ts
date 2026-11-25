import type { Request, Response, ProblemDetails, StateChange } from "./rfc8620-jmap.ts";

/** Server-wide details for `urn:ietf:params:jmap:websocket`. */
export interface WebSocketSessionCapabilities {
  url: string;
  supportsPush: boolean;
}

/** @see https://www.rfc-editor.org/info/rfc8887/#section-4.3.2 */
export interface WebSocketRequest extends Request {
  "@type": "Request";
  id?: string;
}

/** @see https://www.rfc-editor.org/info/rfc8887/#section-4.3.3 */
export interface WebSocketResponse extends Response {
  "@type": "Response";
  requestId?: string;
}

/** @see https://www.rfc-editor.org/info/rfc8887/#section-4.3.4 */
export interface WebSocketProblemDetails extends ProblemDetails {
  "@type": "RequestError";
  requestId?: string;
}

/** @see https://www.rfc-editor.org/info/rfc8887/#section-4.3.5 */
export interface WebSocketStateChange extends StateChange {
  pushState?: string;
}

/** @see https://www.rfc-editor.org/info/rfc8887/#section-4.3.5 */
export interface WebSocketPushEnable {
  "@type": "WebSocketPushEnable";
  dataTypes: string[] | null;
  pushState?: string;
}

/** @see https://www.rfc-editor.org/info/rfc8887/#section-4.3.5 */
export interface WebSocketPushDisable {
  "@type": "WebSocketPushDisable";
}
