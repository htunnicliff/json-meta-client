import { describe, expect, it, vi } from "vitest";

import { makeSession } from "../../__test__/fixtures.ts";
import type { PushEvents } from "../../transports/types.ts";
import type { OnStateChangeHandler } from "../../types.ts";
import { StateChangeHub } from "../state-change-hub.ts";

function hub() {
  let events: PushEvents | undefined;
  const instance = new StateChangeHub({
    transport: {
      send: async () => ({ methodResponses: [], sessionState: "state" }),
      subscribe: (_session, given) => {
        events = given;
        return { [Symbol.dispose]: () => {} };
      },
    },
    openEventStream: async () => {
      throw new Error("Unexpected event stream");
    },
    isPrimaryAccount: () => true,
  });
  const emit = () =>
    events?.onStateChange({ "@type": "StateChange", changed: { account: { Email: "s1" } } });
  return { hub: instance, emit };
}

describe(StateChangeHub, () => {
  it("delivers nothing to a handler before its caller holds the subscription", async () => {
    const { hub: instance, emit } = hub();
    const session = makeSession();
    await instance.add(session, () => {}, 30);
    const late = vi.fn<OnStateChangeHandler>();

    const adding = instance.add(session, late, 30);
    // The shared channel is already open, so this arrives while `add` awaits it
    emit();
    await adding;
    expect(late).not.toHaveBeenCalled();

    emit();
    expect(late).toHaveBeenCalledOnce();
  });
});
