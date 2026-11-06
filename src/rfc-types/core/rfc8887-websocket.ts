// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import type { Request, Response, ProblemDetails, StateChange } from "./rfc8620-jmap.ts";

declare module "../extensions.ts" {
  export interface SessionCapabilities {
    "urn:ietf:params:jmap:websocket": {
      url: string;
      supportsPush: boolean;
    };
  }
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
