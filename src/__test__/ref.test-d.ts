import { describe, expectTypeOf, it } from "vitest";

import type { BatchResult } from "../batcher.ts";
import type { MethodCall } from "../method-calls.ts";
import { ref, type ExtractByPointer, type Ref } from "../ref.ts";

// ─── Simple object shape ──────────────────────────────────────────────────
type User = {
  name: string;
  age: number;
  meta: Record<string, unknown>;
  friends: Array<{ id: string; username: string }>;
};

// ─── Nested JMAP-like types for realistic tests ───────────────────────────
type MessageWithTags = {
  id: string;
  subject: string | null;
  from: { name: string; email: string };
  headerNames: Array<string>;
};

declare const userCall: BatchResult<MethodCall<unknown>, User>;
declare const messageCall: BatchResult<MethodCall<unknown>, MessageWithTags>;

// ─── Single-segment property access ───────────────────────────────────────
describe("single-segment access", () => {
  it("/name resolves to string", () => {
    type Result = ExtractByPointer<User, "/name">;
    expectTypeOf<Result>().toEqualTypeOf<string>();
  });

  it("/age resolves to number", () => {
    type Result = ExtractByPointer<User, "/age">;
    expectTypeOf<Result>().toEqualTypeOf<number>();
  });

  it("/friends resolves to array element type", () => {
    type Result = ExtractByPointer<User, "/friends">;
    expectTypeOf<Result>().toEqualTypeOf<{ id: string; username: string }[]>();
  });

  it("/meta resolves to Record<string, unknown>", () => {
    type Result = ExtractByPointer<User, "/meta">;
    expectTypeOf<Result>().toEqualTypeOf<Record<string, unknown>>();
  });
});

// ─── Multi-segment property chain ─────────────────────────────────────────
describe("multi-segment property chain", () => {
  it("/friends/0/id - array element then property", () => {
    type Result = ExtractByPointer<User, "/friends/0/id">;
    expectTypeOf<Result>().toEqualTypeOf<string>();
  });

  it("/friends/1/username - numeric index with different segment", () => {
    type Result = ExtractByPointer<User, "/friends/1/username">;
    expectTypeOf<Result>().toEqualTypeOf<string>();
  });
});

// ─── Wildcard patterns ─────────────────────────────────────────────────────
describe("wildcard patterns", () => {
  it("/friends/*/id - wildcard collects matching values into an array", () => {
    type Result = ExtractByPointer<User, "/friends/*/id">;
    expectTypeOf<Result>().toEqualTypeOf<string[]>();
  });

  it("/friends/* - standalone wildcard yields an array of elements", () => {
    type Result = ExtractByPointer<User, "/friends/*">;
    expectTypeOf<Result>().toEqualTypeOf<{ id: string; username: string }[]>();
  });
});

// ─── JMAP-style realistic tests ─────────────────────────────────────────────
describe("JMAP-style nested types", () => {
  it("/id - top-level string property", () => {
    type Result = ExtractByPointer<MessageWithTags, "/id">;
    expectTypeOf<Result>().toEqualTypeOf<string>();
  });

  it("/subject - top-level nullable string", () => {
    type Result = ExtractByPointer<MessageWithTags, "/subject">;
    expectTypeOf<Result>().toEqualTypeOf<string | null>();
  });

  it("/from/name - nested object property access", () => {
    type Result = ExtractByPointer<MessageWithTags, "/from/name">;
    expectTypeOf<Result>().toEqualTypeOf<string>();
  });

  it("/from/email - deeper nesting", () => {
    type Result = ExtractByPointer<MessageWithTags, "/from/email">;
    expectTypeOf<Result>().toEqualTypeOf<string>();
  });

  it("/headerNames/*/0 - wildcard collects indexed chars into an array", () => {
    type Result = ExtractByPointer<MessageWithTags, "/headerNames/*/0">;
    expectTypeOf<Result>().toEqualTypeOf<string[]>();
  });

  it("/headerNames/2 - numeric index into array", () => {
    type Result = ExtractByPointer<MessageWithTags, "/headerNames/2">;
    expectTypeOf<Result>().toEqualTypeOf<string>();
  });
});

// ─── Edge cases ────────────────────────────────────────────────────────────
describe("edge cases", () => {
  it("wildcard on a plain object (not an array) returns never", () => {
    type Result = ExtractByPointer<User, "/name/*/extra">;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });

  it("unknown property name in chain should return never", () => {
    type TestObj = { a: { b: number } };
    type Result = ExtractByPointer<TestObj, "/a/invalidKey">;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });

  it("numeric index on non-array type returns never", () => {
    type Result = ExtractByPointer<User, "/age/0/foo">;
    expectTypeOf<Result>().toEqualTypeOf<never>();
  });
});

// ─── Verify the type is importable and usable like this: ────────────────────
function resolvePointer<T, P extends string>(_obj: T, _pointer: P): ExtractByPointer<T, P> {
  throw new Error("not implemented");
}

describe("exports work in user code", () => {
  it("ExtractByPointer can be used as a generic constraint in real code", () => {
    const user = null! as User;
    const name = resolvePointer(user, "/name" as const);
    expectTypeOf(name).toEqualTypeOf<string>();

    const friendId = resolvePointer(user, "/friends/0/id" as const);
    expectTypeOf(friendId).toEqualTypeOf<string>();
  });

  it("should work with complex JMAP return types", () => {
    const msg = null! as MessageWithTags;
    const fromObj = resolvePointer(msg, "/from" as const);
    expectTypeOf(fromObj).toEqualTypeOf<{ name: string; email: string }>();

    const subject = resolvePointer(msg, "/subject" as const);
    expectTypeOf(subject).toEqualTypeOf<string | null>();
  });
});

// ─── ref() carries ExtractByPointer through Ref ─────────────────────────────
describe("ref()", () => {
  it("returns Ref of the type at the pointer", () => {
    const nameRef = ref(userCall, "/name");
    expectTypeOf(nameRef).toEqualTypeOf<Ref<string>>();

    const friendIdRef = ref(userCall, "/friends/*/id");
    expectTypeOf(friendIdRef).toEqualTypeOf<Ref<string[]>>();

    const friendsRef = ref(userCall, "/friends");
    expectTypeOf(friendsRef).toEqualTypeOf<Ref<{ id: string; username: string }[]>>();

    const subjectRef = ref(messageCall, "/subject");
    expectTypeOf(subjectRef).toEqualTypeOf<Ref<string | null>>();

    const headerRef = ref(messageCall, "/headerNames/2");
    expectTypeOf(headerRef).toEqualTypeOf<Ref<string>>();
  });

  it("rejects pointers that ExtractByPointer cannot resolve", () => {
    // @ts-expect-error — wildcard on a non-array
    ref(userCall, "/name/*/extra");

    // @ts-expect-error — unknown property
    ref(userCall, "/nope");

    // @ts-expect-error — numeric index on a non-array
    ref(userCall, "/age/0");
  });
});
