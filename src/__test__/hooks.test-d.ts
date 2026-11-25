import { assertType, describe, expectTypeOf, it } from "vitest";

import type * as PublicTypes from "../index.ts";
import type {
  AfterEventSourceConnectHook,
  AfterFetchHook,
  AfterJmapResponseHook,
  BeforeEventSourceConnectHook,
  BeforeFetchHook,
  BeforeJmapRequestHook,
  Config,
} from "../index.ts";
import type { Request as JmapRequest, Response as JmapResponse } from "../rfc-types/core/index.ts";

describe("hook types", () => {
  it("contextually types all hooks and accepts sync and async replacements", () => {
    assertType<Config<[]>>({
      sessionUrl: "https://example.test/session",
      capabilities: [],
      auth: "token",
      hooks: {
        beforeFetch: [
          ({ httpRequest }) => {
            expectTypeOf(httpRequest).toEqualTypeOf<Request>();
            return httpRequest;
          },
          async ({ httpRequest }) => httpRequest,
        ],
        afterFetch: [
          ({ httpRequest, httpResponse }) => {
            expectTypeOf(httpRequest).toEqualTypeOf<Request>();
            expectTypeOf(httpResponse).toEqualTypeOf<Response>();
            return httpResponse;
          },
          async ({ httpResponse }) => httpResponse,
        ],
        beforeJmapRequest: [
          ({ jmapRequest }) => {
            expectTypeOf(jmapRequest).toEqualTypeOf<JmapRequest>();
            return jmapRequest;
          },
          async ({ jmapRequest }) => jmapRequest,
        ],
        afterJmapResponse: [
          ({ jmapRequest, jmapResponse }) => {
            expectTypeOf(jmapRequest).toEqualTypeOf<JmapRequest>();
            expectTypeOf(jmapResponse).toEqualTypeOf<JmapResponse>();
            return jmapResponse;
          },
          async ({ jmapResponse }) => jmapResponse,
        ],
        beforeEventSourceConnect: [
          ({ httpRequest }) => {
            expectTypeOf(httpRequest).toEqualTypeOf<Request>();
            return httpRequest;
          },
          async ({ httpRequest }) => httpRequest,
        ],
        afterEventSourceConnect: [
          ({ httpRequest, httpResponse }) => {
            expectTypeOf(httpRequest).toEqualTypeOf<Request>();
            expectTypeOf(httpResponse).toEqualTypeOf<Response>();
          },
          async () => {
            await Promise.resolve();
          },
        ],
      },
    });
    assertType<BeforeEventSourceConnectHook>(({ httpRequest }) => httpRequest);
  });

  it("rejects removed hook properties and type exports", () => {
    type Hooks = NonNullable<Config<[]>["hooks"]>;
    // @ts-expect-error - The old request hook property has been removed.
    assertType<Hooks>({ beforeRequest: [] });
    // @ts-expect-error - The old response hook property has been removed.
    assertType<Hooks>({ afterResponse: [] });
    // @ts-expect-error - The old request hook type is no longer exported.
    expectTypeOf<PublicTypes.BeforeRequestHook>();
    // @ts-expect-error - The old response hook type is no longer exported.
    expectTypeOf<PublicTypes.AfterResponseHook>();
  });

  it("rejects cross-layer arguments, wrong replacements, and missing returns", () => {
    // @ts-expect-error - Fetch hooks receive an argument object.
    assertType<BeforeFetchHook>((request: Request) => request);
    // @ts-expect-error - Fetch hooks receive an HTTP request.
    assertType<BeforeFetchHook>(({ jmapRequest }) => new Request(jmapRequest));
    // @ts-expect-error - JMAP response hooks receive JMAP envelopes.
    assertType<AfterJmapResponseHook>(({ httpResponse }) => httpResponse);
    // @ts-expect-error - Request transformers must return a Request.
    assertType<BeforeFetchHook>(() => {});
    // @ts-expect-error - Response transformers cannot return a request.
    assertType<AfterFetchHook>(({ httpRequest }) => httpRequest);
    // @ts-expect-error - Envelopes are not Fetch requests.
    assertType<BeforeJmapRequestHook>(() => new Request("https://example.test"));
    // @ts-expect-error - Envelope hooks require all request fields.
    assertType<BeforeJmapRequestHook>(() => ({ using: [] }));
    // @ts-expect-error - JMAP response hooks must return a response envelope.
    assertType<AfterJmapResponseHook>(async () => new Response());
    // @ts-expect-error - JMAP response envelopes require sessionState.
    assertType<AfterJmapResponseHook>(() => ({ methodResponses: [] }));
    // @ts-expect-error - Connection request hooks return a Fetch Request.
    assertType<BeforeEventSourceConnectHook>(async () => ({ methodCalls: [], using: [] }));
    // @ts-expect-error - Connection observers cannot replace the validated response.
    assertType<AfterEventSourceConnectHook>(() => new Response());
    // @ts-expect-error - Async observers cannot replace the validated response either.
    assertType<AfterEventSourceConnectHook>(async ({ httpResponse }) => httpResponse);
  });
});
