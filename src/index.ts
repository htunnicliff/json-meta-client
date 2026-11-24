// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

export type {
  Capability,
  DefaultAccount,
  DefaultAccountSetting,
  InferMethodsFromCapability,
  MethodContract,
} from "./capability.ts";
export { defineCapability } from "./capability.ts";
export * from "./client.ts";
export * from "./errors/index.ts";
export * from "./types.ts";
export * from "./transports/index.ts";
export type {
  Request as JmapRequest,
  Response as JmapResponse,
  Session,
  StateChange,
  WebSocketPushDisable,
  WebSocketPushEnable,
  WebSocketRequest,
  WebSocketResponse,
  WebSocketSessionCapabilities,
  WebSocketStateChange,
} from "./rfc-types/core/index.ts";
