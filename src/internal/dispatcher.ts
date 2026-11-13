// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { core } from "../capabilities/core.ts";
import { CancellationError, JmapError, MethodCallError } from "../errors.ts";
import type {
  Invocation,
  Request as JmapRequest,
  Response as JmapResponse,
  Session,
} from "../rfc-types/core/index.ts";
import type { AfterJmapResponseHook, BeforeJmapRequestHook } from "../types.ts";
import type { MethodCall } from "./method-call.ts";

/**
 * Sends a JMAP Request envelope and returns the server's Response envelope
 */
export interface Transport {
  (request: JmapRequest, session: Session): Promise<JmapResponse>;
}

export interface DispatcherOptions {
  transport: Transport;
  session: () => Promise<Session>;
  /**
   * The capability URNs, including `dependsOn`, that a call on the entity needs
   */
  urnsForEntity: (entity: string) => Iterable<string>;
  hooks?: {
    beforeJmapRequest?: ReadonlyArray<BeforeJmapRequestHook>;
    afterJmapResponse?: ReadonlyArray<AfterJmapResponseHook>;
  };
}

interface Pending {
  methodCall: MethodCall<object>;
  handle: PromiseWithResolvers<any>;
}

/**
 * Owns the batch lifecycle: collects the method calls made in the same tick
 * into a batch, sends it as one JMAP Request, and settles each method call
 * from the Response
 */
export class Dispatcher {
  constructor(options: DispatcherOptions) {
    this.#options = options;
  }

  readonly #options: DispatcherOptions;

  /**
   * Method calls waiting in the current batch
   */
  #batch: Pending[] = [];

  /**
   * Add a method call to the current batch and get a promise for its
   * response arguments
   */
  send = <T>(methodCall: MethodCall<object>): Promise<T> => {
    const handle = Promise.withResolvers<T>();
    if (this.#batch.length === 0) {
      queueMicrotask(() => {
        const batch = this.#batch.splice(0);
        if (batch.length > 0) void this.#dispatch(batch);
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
   * with the same error when the batch fails as a whole
   */
  async #dispatch(batch: Pending[]): Promise<void> {
    try {
      const response = await this.#exchange(batch.map(({ methodCall }) => methodCall));
      const responsesById = Map.groupBy(response.methodResponses, ([, , id]) => id);
      for (const { methodCall, handle } of batch) {
        settle(methodCall, handle, responsesById.get(methodCall.id));
      }
    } catch (error) {
      for (const { handle } of batch) {
        handle.reject(error);
      }
    }
  }

  /**
   * Turn method calls into a JMAP Request, send it, and return the Response,
   * running the JMAP envelope hooks on each
   */
  async #exchange(methodCalls: MethodCall<object>[]): Promise<JmapResponse> {
    const using = new Set<string>([core.urn]);
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
    const session = await this.#options.session();
    for (const hook of this.#options.hooks?.beforeJmapRequest ?? []) {
      // oxlint-disable-next-line no-await-in-loop
      request = await hook({ request });
    }
    let response = await this.#options.transport(request, session);
    for (const hook of this.#options.hooks?.afterJmapResponse ?? []) {
      // oxlint-disable-next-line no-await-in-loop
      response = await hook({ request, response });
    }
    return response;
  }
}

/**
 * Settle a method call from the responses that share its call id
 */
function settle(
  methodCall: MethodCall<object>,
  handle: PromiseWithResolvers<unknown>,
  responses: Invocation[] = [],
): void {
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
