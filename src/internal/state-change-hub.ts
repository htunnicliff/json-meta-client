// ----------------------------------------------------------------------- //
//                                                                         //
//   Copyright (c) 2026 Hunter Tunnicliff                                  //
//                                                                         //
//   This source code is subject to the terms of the Mozilla Public        //
//   License, version 2.0. If a copy of the MPL was not distributed with   //
//   this file, you can obtain one at https://mozilla.org/MPL/2.0/.        //
//                                                                         //
// ----------------------------------------------------------------------- //

import { CancellationError, StateChangeError } from "../errors/index.ts";
import type { Session, StateChange } from "../rfc-types/core/index.ts";
import type { PushEvents, Transport } from "../transports/types.ts";
import type { OnStateChangeHandler, StateChangePayload } from "../types.ts";
import { disposable, dispose } from "./disposable.ts";
import { readStateChanges } from "./read-state-changes.ts";

export interface StateChangeHubOptions {
  transport: Transport;
  /**
   * Open the event stream, for a transport that provides no push channel
   */
  openEventStream: (
    session: Session,
    events: PushEvents,
    pingSeconds: number,
  ) => Promise<Disposable>;
  isPrimaryAccount: (session: Session, entity: string, accountId: string) => boolean;
}

/**
 * A handler added to a channel. It receives events once `ready`, which is
 * when its caller holds the subscription.
 */
interface Entry {
  handler: OnStateChangeHandler;
  ready: boolean;
}

/**
 * One open push channel and the handlers that share it
 */
interface Subscription {
  handlers: Set<Entry>;
  /** Settles with the channel once it is open */
  channel: Promise<Disposable>;
  /** Forget this subscription so the next handler opens a new channel */
  forget: () => void;
}

/**
 * The transport-agnostic layer of state changes. It keeps one push channel
 * open for every `onStateChange` handler, turns each `StateChange` into
 * payloads, and closes the channel when the last handler leaves.
 *
 * The transport's channel is shared by every handler. Event streams are
 * shared by the handlers that ask for the same ping interval.
 */
export class StateChangeHub {
  constructor(options: StateChangeHubOptions) {
    this.#options = options;
  }

  readonly #options: StateChangeHubOptions;

  /** The transport's push channel, when it provides one */
  #push: Subscription | undefined;

  /** Event streams by ping interval */
  readonly #eventStreams = new Map<number, Subscription>();

  #closed = false;

  /**
   * Add a handler, opening a push channel if none can be shared
   */
  add = async (
    session: Session,
    handler: OnStateChangeHandler,
    pingSeconds: number,
  ): Promise<Disposable> => {
    if (this.#closed) throw new CancellationError("The client was disposed");
    const subscription =
      this.#push ?? this.#eventStreams.get(pingSeconds) ?? this.#open(session, pingSeconds);
    // Joining now keeps the channel open for this handler while it opens
    const entry: Entry = { handler, ready: false };
    subscription.handlers.add(entry);
    try {
      await subscription.channel;
    } catch (error) {
      subscription.handlers.delete(entry);
      throw error;
    }
    entry.ready = true;
    let removed = false;
    return disposable(() => {
      if (removed) return;
      removed = true;
      this.#remove(subscription, entry);
    });
  };

  /**
   * Close every push channel and drop every handler
   */
  close = (): void => {
    this.#closed = true;
    const subscriptions = [this.#push, ...this.#eventStreams.values()];
    for (const subscription of subscriptions) {
      if (!subscription) continue;
      subscription.handlers.clear();
      this.#closeChannel(subscription);
    }
  };

  #open(session: Session, pingSeconds: number): Subscription {
    const handlers = new Set<Entry>();
    const events = this.#fanOut(session, handlers);
    const pushChannel = this.#options.transport.subscribe?.(session, events) ?? null;
    if (pushChannel) {
      const subscription: Subscription = {
        handlers,
        channel: Promise.resolve(pushChannel),
        forget: () => {
          if (this.#push === subscription) this.#push = undefined;
        },
      };
      this.#push = subscription;
      subscription.channel.catch(() => subscription.forget());
      return subscription;
    }
    const subscription: Subscription = {
      handlers,
      channel: this.#options.openEventStream(session, events, pingSeconds),
      forget: () => {
        if (this.#eventStreams.get(pingSeconds) === subscription) {
          this.#eventStreams.delete(pingSeconds);
        }
      },
    };
    this.#eventStreams.set(pingSeconds, subscription);
    subscription.channel.catch(() => subscription.forget());
    return subscription;
  }

  #remove(subscription: Subscription, entry: Entry): void {
    subscription.handlers.delete(entry);
    if (subscription.handlers.size === 0) this.#closeChannel(subscription);
  }

  #closeChannel(subscription: Subscription): void {
    subscription.forget();
    subscription.channel.then(dispose, () => {});
  }

  /**
   * Push events that turn each state change into payloads and send them to
   * every handler
   */
  #fanOut(session: Session, handlers: ReadonlySet<Entry>): PushEvents {
    const deliver = (...args: Parameters<OnStateChangeHandler>): void => {
      for (const { handler, ready } of handlers) {
        if (!ready) continue;
        try {
          handler(...args);
        } catch (error) {
          // A handler's own error must not stop delivery to the others
          queueMicrotask(() => {
            throw error;
          });
        }
      }
    };
    return {
      onStateChange: (change: StateChange) => {
        let payloads: StateChangePayload[];
        try {
          payloads = Array.from(readStateChanges(change), (payload) => ({
            ...payload,
            isPrimaryAccount: this.#options.isPrimaryAccount(
              session,
              payload.entity,
              payload.accountId,
            ),
          }));
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "An error occurred when parsing a state change message payload";
          deliver(new StateChangeError(message, { cause: error }), undefined);
          return;
        }
        for (const payload of payloads) deliver(null, payload);
      },
      onError: (error) => deliver(error, undefined),
    };
  }
}
