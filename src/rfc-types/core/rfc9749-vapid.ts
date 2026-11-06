// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

declare module "../extensions.ts" {
  export interface SessionCapabilities {
    /** @see https://www.rfc-editor.org/info/rfc9749/#section-3 */
    "urn:ietf:params:jmap:webpush-vapid": {
      applicationServerKey: string;
    };
  }
}
