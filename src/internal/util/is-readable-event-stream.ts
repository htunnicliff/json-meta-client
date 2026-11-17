// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

/**
 * Whether a response is an event stream whose body is still unread
 */
export function isReadableEventStream(response: Response): boolean {
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
  return (
    response.status === 200 &&
    contentType?.toLowerCase() === "text/event-stream" &&
    response.body !== null &&
    !response.bodyUsed &&
    !response.body.locked
  );
}
