import type { Capability } from "./capability.ts";
import type { Config } from "./client.ts";
import type { JobResult } from "./internal/batch.ts";
import type { MethodCall } from "./internal/method-calls.ts";

export type ClientOptions<T extends ReadonlyArray<Capability> = ReadonlyArray<Capability>> =
  Config<T>;

export type PendingMethodCall<Input = unknown, Output = unknown> = JobResult<
  MethodCall<Input>,
  Output
>;
