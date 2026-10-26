declare namespace JMAP {
  export interface SessionCapabilities {
    "urn:ietf:params:jmap:websocket": {
      url: string;
      supportsPush: boolean;
    };
  }

  export interface WebSocketRequest extends JMAP.Request {
    "@type": "Request";
    id?: string;
  }

  export interface WebSocketResponse extends JMAP.Response {
    "@type": "Response";
    requestId?: string;
  }

  export interface WebSocketProblemDetails extends JMAP.ProblemDetails {
    "@type": "RequestError";
    requestId?: string;
  }

  export interface WebSocketStateChange extends JMAP.StateChange {
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
}
