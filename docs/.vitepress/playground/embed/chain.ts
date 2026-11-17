import type { BatchEntry } from "../timeline.ts";

/**
 * One step of a Batch's chain: a method call, or the result reference that
 * leads from one method call to the next
 */
export type ChainLink =
  | { kind: "call"; label: string; name: string }
  | { kind: "reference"; path: string };

/**
 * A Batch as a one-line chain of method calls and result references, such as
 * `#1 → /ids → #2`. A reference sits between a method call and the one before
 * it when the later call uses the earlier one's result.
 */
export function batchChain(batch: BatchEntry): ChainLink[] {
  return batch.calls.flatMap((call, index): ChainLink[] => {
    const link: ChainLink = { kind: "call", label: call.label, name: call.name };
    if (index === 0) return [link];
    const previous = batch.calls[index - 1]?.label;
    const reference = call.args.find((arg) => arg.reference?.label === previous)?.reference;
    return reference ? [{ kind: "reference", path: reference.path }, link] : [link];
  });
}
