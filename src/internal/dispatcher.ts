import { DEFAULT_CAPABILITIES } from "../built-ins.ts";
import {
  CancellationError,
  ConfigurationError,
  JmapError,
  JsonMetaError,
  MethodCallError,
  NetworkError,
  ResultReferenceError,
  UnknownError,
} from "../errors/index.ts";
import type { ResultReferenceErrorReason } from "../errors/index.ts";
import type {
  Invocation,
  Request as JmapRequest,
  Response as JmapResponse,
  Session,
} from "../rfc-types/core/index.ts";
import type { Transport } from "../transports/types.ts";
import type { CapabilityOption, Config } from "../types.ts";
import type { FindMethodOwner } from "./capability-index.ts";
import { resolveDefaultAccount } from "./capability-index.ts";
import type { MethodCall } from "./method-call.ts";
import { containsRef, isRef } from "./ref.ts";

export interface DispatcherOptions {
  transport: Transport;
  /**
   * Aborted when the client is disposed
   */
  signal: AbortSignal;
  session: () => Promise<Session>;
  /**
   * The capability URNs, including `dependsOn`, that a call on the entity needs
   */
  urnsForEntity: (entity: string) => Iterable<string>;
  /**
   * Finds the capability that gives a method call its default account
   */
  findMethodOwner: FindMethodOwner;
  /**
   * The JMAP envelope hooks
   */
  hooks?: Pick<
    NonNullable<Config<ReadonlyArray<CapabilityOption>>["hooks"]>,
    "beforeJmapRequest" | "afterJmapResponse"
  >;
}

/**
 * A method call waiting in a batch, with the handle that settles its promise
 */
interface PendingMethodCall {
  methodCall: MethodCall<object>;
  handle: PromiseWithResolvers<unknown>;
}

/**
 * Owns the batch lifecycle: collects the method calls made in the same tick
 * into a batch, gives each its default account, sends the batch as one JMAP
 * Request, and settles each method call from the Response
 */
export class Dispatcher {
  constructor(options: DispatcherOptions) {
    this.#options = options;
  }

  readonly #options: DispatcherOptions;

  /**
   * Method calls waiting in the current batch
   */
  #batch: PendingMethodCall[] = [];

  /**
   * Add a method call to the current batch and get a promise for its
   * response arguments
   */
  send = (methodCall: MethodCall<object>): Promise<unknown> => {
    const handle = Promise.withResolvers<unknown>();
    if (this.#options.signal.aborted) {
      handle.reject(new CancellationError("The client was disposed"));
      return handle.promise;
    }
    if (this.#batch.length === 0) {
      queueMicrotask(() => {
        const batch = this.#batch.splice(0);
        if (batch.length > 0) {
          void this.#dispatch(batch);
        }
      });
    }
    this.#batch.push({ methodCall, handle });
    return handle.promise;
  };

  /**
   * Reject every method call still waiting in the current batch. A batch
   * already being sent is unaffected.
   */
  cancel = (): void => {
    for (const { handle } of this.#batch.splice(0)) {
      handle.reject(new CancellationError("Batch was cancelled"));
    }
  };

  /**
   * Send a batch and settle its method calls, rejecting every method call
   * with the same error when the batch fails as a whole. A method call that
   * breaks a result reference rule, or whose default account is ambiguous,
   * is rejected on its own and left out of the Request.
   */
  async #dispatch(batch: PendingMethodCall[]): Promise<void> {
    const earlierIds = new Set<string>();
    let unsettled = batch.filter(({ methodCall, handle }) => {
      const reason = brokenResultRefRule(methodCall, earlierIds);
      earlierIds.add(methodCall.id);
      if (reason) {
        handle.reject(new ResultReferenceError(reason, methodCall));
      }
      return !reason;
    });
    try {
      if (this.#options.signal.aborted) {
        throw new CancellationError("The client was disposed");
      }
      const session = await this.#options.session();
      unsettled = unsettled.filter((pending) => this.#addDefaultAccount(pending, session));
      if (unsettled.length === 0) {
        return;
      }

      const response = await this.#sendBatch(
        unsettled.map(({ methodCall }) => methodCall),
        session,
      );
      const responsesById = Map.groupBy(response.methodResponses, ([, , id]) => id);
      for (const pending of unsettled) {
        settle(pending, responsesById.get(pending.methodCall.id));
      }
    } catch (error) {
      for (const { handle } of unsettled) {
        handle.reject(error);
      }
    }
  }

  /**
   * Write the default account's ID onto the arguments of a method call that
   * doesn't pass `accountId`. Rejects the method call when the session
   * leaves the choice between several accounts.
   *
   * @returns whether the method call can be sent
   */
  #addDefaultAccount({ methodCall, handle }: PendingMethodCall, session: Session): boolean {
    const { method, args } = methodCall;
    // `#accountId` is a result reference that the caller passed as `accountId`
    if (Object.hasOwn(args, "accountId") || Object.hasOwn(args, "#accountId")) {
      return true;
    }

    const account = resolveDefaultAccount(this.#options.findMethodOwner(method), session);
    if (account.status === "ambiguous") {
      handle.reject(
        new ConfigurationError(
          `Cannot choose a default account for ${method}: several accounts support ` +
            `${account.urn}, and the session names no primary account for it. ` +
            "Pass `accountId` to choose one.",
        ),
      );
      return false;
    }
    if (account.status === "resolved") {
      Object.assign(args, { accountId: account.accountId });
    }
    return true;
  }

  /**
   * Send a batch's method calls as one JMAP Request and return the Response,
   * running the JMAP envelope hooks on each
   */
  async #sendBatch(methodCalls: MethodCall<object>[], session: Session): Promise<JmapResponse> {
    const using = new Set<string>(DEFAULT_CAPABILITIES.map(({ urn }) => urn));
    for (const methodCall of methodCalls) {
      const [entity] = /^[^/]+/.exec(methodCall.method)!;
      for (const urn of this.#options.urnsForEntity(entity)) {
        using.add(urn);
      }
    }
    let request: JmapRequest = {
      using: [...using],
      methodCalls: methodCalls.map((methodCall) => methodCall.toInvocation()),
    };
    for (const hook of this.#options.hooks?.beforeJmapRequest ?? []) {
      // oxlint-disable-next-line no-await-in-loop
      request = await hook({ jmapRequest: request });
    }
    let response = await this.#send(request, session);
    for (const hook of this.#options.hooks?.afterJmapResponse ?? []) {
      // oxlint-disable-next-line no-await-in-loop
      response = await hook({ jmapRequest: request, jmapResponse: response });
    }
    return response;
  }

  /**
   * Send a JMAP Request through the transport. A failure that isn't a
   * `JsonMetaError` becomes a `CancellationError` once the client is
   * disposed, and a `NetworkError` otherwise, so callers can always catch
   * `JsonMetaError`.
   */
  async #send(request: JmapRequest, session: Session): Promise<JmapResponse> {
    const { transport, signal } = this.#options;
    if (signal.aborted) {
      throw new CancellationError("The client was disposed");
    }
    let response: unknown;
    try {
      response = await transport.send(request, { session, signal });
    } catch (error) {
      if (error instanceof JsonMetaError) {
        throw error;
      }
      if (signal.aborted) {
        throw new CancellationError("The client was disposed", { cause: error });
      }
      throw new NetworkError(error instanceof Error ? error.message : "Transport failed", {
        cause: error,
        request: undefined,
      });
    }
    if (!isJmapResponse(response)) {
      throw new UnknownError("The transport returned something that isn't a JMAP Response", {
        cause: response,
      });
    }
    return response;
  }
}

/**
 * Whether a value has the shape of a JMAP Response, enough to settle method
 * calls from
 */
function isJmapResponse(value: unknown): value is JmapResponse {
  return (
    typeof value === "object" &&
    value !== null &&
    Array.isArray((value as { methodResponses?: unknown }).methodResponses)
  );
}

/**
 * The RFC 8620 §3.7 result reference rule that a method call breaks, if any.
 * A reference to a method call that the client rejects is still sent, and
 * the server answers it with `invalidResultReference`.
 */
function brokenResultRefRule(
  { id, args }: MethodCall<object>,
  earlierIds: ReadonlySet<string>,
): ResultReferenceErrorReason | undefined {
  if (earlierIds.has(id)) {
    return "duplicate-id";
  }
  for (const [key, value] of Object.entries(args)) {
    if (isRef(value)) {
      if (!earlierIds.has(value.resultOf)) {
        return "cross-batch";
      }
    } else if (containsRef(value)) {
      return "nested";
    }
    if (key.startsWith("#") && Object.hasOwn(args, key.slice(1))) {
      return "duplicate-argument";
    }
  }
  return undefined;
}

/**
 * Settle a method call from the responses that share its call id
 */
function settle({ methodCall, handle }: PendingMethodCall, responses: Invocation[] = []): void {
  const response =
    responses.find(([method]) => method === methodCall.method || method === "error") ??
    responses[0];
  if (!response) {
    handle.reject(
      new MethodCallError(`No response for method call "${methodCall.id}"`, { methodCall }),
    );
    return;
  }

  const [method, data] = response;
  if (method === methodCall.method) {
    handle.resolve(data);
  } else if (method === "error") {
    handle.reject(
      JmapError.isProblemDetails(data)
        ? new JmapError("Error in method call", data, { methodCall })
        : new MethodCallError("Unknown error in method call", { methodCall, responseData: data }),
    );
  } else {
    handle.reject(
      new MethodCallError(`Unexpected response method "${method}" for "${methodCall.method}"`, {
        methodCall,
        responseData: data,
      }),
    );
  }
}
