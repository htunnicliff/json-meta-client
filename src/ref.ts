import type { ExtendedJSONPointer, ResultReference } from "jmap-rfc-types";

import type { MethodCall } from "./method-calls.ts";

export function ref<T>(methodCall: MethodCall<T>, pointer: ExtendedJSONPointer): ResultReference {
  return {
    name: methodCall.method,
    resultOf: methodCall.id,
    path: pointer,
  };
}
