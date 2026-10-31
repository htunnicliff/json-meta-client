import type { Request, Response, ProblemDetails, StateChange } from "./rfc8620-jmap.ts";

export interface Rfc8887SessionCapabilities {
  "urn:ietf:params:jmap:websocket": {
    url: string;
    supportsPush: boolean;
  };
}

export interface WebSocketRequest extends Request {
  "@type": "Request";
  id?: string;
}

export interface WebSocketResponse extends Response {
  "@type": "Response";
  requestId?: string;
}

export interface WebSocketProblemDetails extends ProblemDetails {
  "@type": "RequestError";
  requestId?: string;
}

export interface WebSocketStateChange extends StateChange {
  pushState?: string;
}

export interface WebSocketPushEnable {
  "@type": "WebSocketPushEnable";
  dataTypes: string[] | null;
  pushState?: string;
}

export interface WebSocketPushDisable {
  "@type": "WebSocketPushDisable";
}
