import { DEFAULT_CAPABILITIES } from "../built-ins.ts";
import type { Capability, DefaultAccount } from "../capability.ts";
import { CapabilityConfigurationError } from "../errors/index.ts";
import type { Session } from "../rfc-types/core/index.ts";

/** The capability that claims a method call, and the default account it gives it. */
export interface MethodOwner {
  urn: string;
  defaultAccount: DefaultAccount;
}

/** Finds the owner of a method call by its `Entity/method` name. */
export type FindMethodOwner = (name: string) => MethodOwner | undefined;

/**
 * Maps each method call to the capability that claims it in its
 * `defaultAccount` setting. A listed method name beats another capability's
 * `"*"`. Extending capabilities never claim method calls.
 *
 * @throws {CapabilityConfigurationError} when two capabilities claim the same
 * method call with different URNs or default accounts
 */
export function mapMethodOwners(capabilities: Iterable<Capability>): FindMethodOwner {
  const listed = new Map<string, MethodOwner>();
  const wildcards = new Map<string, MethodOwner>();

  const claim = (
    claims: Map<string, MethodOwner>,
    key: string,
    owner: MethodOwner,
    capability: Capability,
  ) => {
    const existing = claims.get(key);
    if (existing === undefined) {
      claims.set(key, owner);
    } else if (existing.urn !== owner.urn || existing.defaultAccount !== owner.defaultAccount) {
      const message =
        claims === listed
          ? `Capabilities ${existing.urn} and ${owner.urn} both claim ${key} in \`defaultAccount\``
          : `Capabilities ${existing.urn} and ${owner.urn} both claim every ${key} method; ` +
            "list the methods one of them claims in its `defaultAccount`";
      throw new CapabilityConfigurationError(message, { capability });
    }
  };

  for (const capability of capabilities) {
    if ("extends" in capability) {
      continue;
    }

    const { urn, entities, defaultAccount: setting = { "*": "primary" } } = capability;
    for (const [key, defaultAccount] of Object.entries(setting)) {
      // An explicit `undefined` reads as an omitted key
      if (defaultAccount === undefined) {
        continue;
      }

      const owner = { urn, defaultAccount };
      if (key === "*") {
        for (const entity of new Set(entities)) {
          claim(wildcards, entity, owner, capability);
        }
      } else {
        claim(listed, key, owner, capability);
      }
    }
  }

  return (name) => {
    if (listed.has(name)) {
      return listed.get(name);
    }
    const entity = name.slice(0, name.indexOf("/"));
    return wildcards.get(entity);
  };
}

export function mapEntitiesToUrns(capabilities: Iterable<Capability>): Record<string, string[]> {
  const entityToUrns: Record<string, string[]> = Object.create(null);

  for (const { urn, entities, dependsOn = [] } of capabilities) {
    for (const entity of entities) {
      const urns = (entityToUrns[entity] ??= []);
      for (const used of [urn, ...dependsOn]) {
        if (!urns.includes(used)) {
          urns.push(used);
        }
      }
    }
  }

  return entityToUrns;
}

/**
 * The default account of a method call that doesn't pass `accountId`:
 *
 * - `resolved`: the account whose ID the client adds
 * - `none`: no capability gives the method call a default account
 * - `unavailable`: no account in the session can use the owner's methods
 * - `ambiguous`: several accounts can, and the session names no primary
 */
export type DefaultAccountResolution =
  | { status: "resolved"; accountId: string }
  | { status: "none" }
  | { status: "unavailable" }
  | { status: "ambiguous"; urn: string };

/**
 * Chooses the default account that a method call's owner gives it: the
 * session's primary account for the owner's URN, or else the only account
 * whose capabilities include that URN.
 */
export function resolveDefaultAccount(
  owner: MethodOwner | undefined,
  session: Session,
): DefaultAccountResolution {
  if (owner?.defaultAccount !== "primary") {
    return { status: "none" };
  }

  const { urn } = owner;
  const primary = session.primaryAccounts[urn];
  if (primary !== undefined) {
    return { status: "resolved", accountId: primary };
  }

  // RFC 8620 §2: an account lists every capability whose methods it can use
  const [accountId, ...others] = Object.entries(session.accounts ?? {})
    .filter(([, account]) => Object.hasOwn(account.accountCapabilities ?? {}, urn))
    .map(([id]) => id);
  if (accountId === undefined) {
    return { status: "unavailable" };
  }
  if (others.length > 0) {
    return { status: "ambiguous", urn };
  }
  return { status: "resolved", accountId };
}

/**
 * Everything the client looks up from its capabilities: the URNs an entity's
 * calls need, the entities it knows, and the default account of each method
 * call
 */
export class CapabilityIndex {
  /**
   * @param configured the configured capabilities, without the default ones
   */
  constructor(configured: ReadonlyArray<Capability>) {
    const capabilities = [...DEFAULT_CAPABILITIES, ...configured];
    this.findMethodOwner = mapMethodOwners(capabilities);
    this.#urns = new Set(capabilities.map(({ urn }) => urn));
    this.#entityToUrns = mapEntitiesToUrns(configured);

    // Default capabilities are always included, so their entities are always known
    this.#knownEntities = new Set([
      ...Object.keys(this.#entityToUrns),
      ...DEFAULT_CAPABILITIES.flatMap((capability) => capability.entities),
    ]);
  }

  /**
   * Finds the capability that gives a method call its default account
   */
  readonly findMethodOwner: FindMethodOwner;

  /**
   * The URNs of the default and configured capabilities
   */
  readonly #urns: ReadonlySet<string>;

  /**
   * Every configured entity's capability URNs, including `dependsOn`
   */
  readonly #entityToUrns: Record<string, string[]>;

  /**
   * Entities declared by a configured or default capability
   */
  readonly #knownEntities: ReadonlySet<string>;

  /**
   * The capability URNs, including `dependsOn`, that a call on the entity needs
   */
  urnsForEntity = (entity: string): ReadonlyArray<string> => this.#entityToUrns[entity] ?? [];

  /**
   * Whether any capability declares the entity
   */
  isKnownEntity = (entity: string): boolean => this.#knownEntities.has(entity);

  /**
   * The URNs, including `dependsOn`, that the configured capabilities send
   * with their calls
   */
  get requestUrns(): ReadonlySet<string> {
    return new Set(Object.values(this.#entityToUrns).flat());
  }

  /**
   * Whether an `Entity/get` call that passes no `accountId` would go to the
   * account, by the same resolution as method calls. Such a call has no
   * default account when no capability owns it, as with push-only types
   * like `EmailDelivery`; the account then counts as primary if it is the
   * primary account of any configured capability, or the session's only
   * account.
   */
  isPrimaryAccount(session: Session, entity: string, accountId: string): boolean {
    const account = resolveDefaultAccount(this.findMethodOwner(`${entity}/get`), session);
    switch (account.status) {
      case "resolved": {
        return account.accountId === accountId;
      }
      case "none": {
        const accountIds = Object.keys(session.accounts ?? {});
        return (
          [...this.#urns].some((urn) => session.primaryAccounts[urn] === accountId) ||
          (accountIds.length === 1 && accountIds[0] === accountId)
        );
      }
      default: {
        return false;
      }
    }
  }
}
