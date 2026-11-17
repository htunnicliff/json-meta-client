<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onUpdated, ref } from "vue";

import type { SourceRange } from "./instrument.ts";
import { FILE_NAME } from "./protocol.ts";
import RawJson from "./RawJson.vue";
import { compactJson } from "./timeline.ts";
import type { BatchEntry } from "./timeline.ts";

const props = defineProps<{
  batch: BatchEntry;
  rawJson: boolean;
  /** Where each method call was made, by label, when known */
  callSites?: Record<string, SourceRange>;
  /** Labels of the method calls to highlight */
  highlighted?: ReadonlySet<string>;
}>();

const emit = defineEmits<{ hoverCall: [label: string | undefined] }>();

const path = computed(() => {
  try {
    return new URL(props.batch.url).pathname;
  } catch {
    return props.batch.url;
  }
});

const summary = computed(() => {
  const { calls, references } = props.batch;
  const parts = [`${calls.length} method call${calls.length === 1 ? "" : "s"}`];
  if (references) parts.push(`${references} result reference${references === 1 ? "" : "s"}`);
  return parts.join(" · ");
});

/**
 * A capability's short name, such as `mail` for `urn:ietf:params:jmap:mail`
 */
function shortUrn(urn: string): string {
  return urn.startsWith("urn:ietf:params:jmap:") ? urn.slice("urn:ietf:params:jmap:".length) : urn;
}

// Connectors from each method call to the result references that use it,
// drawn in the gutter left of the calls
const callsElement = ref<HTMLElement>();
const connectors = ref<{ d: string; key: string }[]>([]);
const GUTTER = 22;
const LANE = 5;

function measure() {
  const container = callsElement.value;
  if (!container) return;
  const origin = container.getBoundingClientRect();
  const centerOf = (element: Element | null) => {
    if (!element) return undefined;
    const box = element.getBoundingClientRect();
    return box.top - origin.top + box.height / 2;
  };
  const next: { d: string; key: string }[] = [];
  let lane = 0;
  for (const call of props.batch.calls) {
    for (const arg of call.args) {
      if (!arg.reference?.label) continue;
      const from = centerOf(container.querySelector(`[data-call="${arg.reference.label}"]`));
      const to = centerOf(container.querySelector(`[data-ref="${call.label}${arg.key}"]`));
      if (from === undefined || to === undefined) continue;
      const x = Math.max(3, GUTTER - 10 - LANE * lane++);
      next.push({
        key: `${call.label}${arg.key}`,
        d: `M ${GUTTER} ${from} H ${x} V ${to} H ${GUTTER - 2}`,
      });
    }
  }
  // Assigning only on change keeps this from re-rendering in a loop
  if (JSON.stringify(next) !== JSON.stringify(connectors.value)) connectors.value = next;
}

let observer: ResizeObserver | undefined;
onMounted(() => {
  measure();
  observer = new ResizeObserver(measure);
  if (callsElement.value) observer.observe(callsElement.value);
});
onUpdated(measure);
onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <article class="batch">
    <header class="batch-header">
      <span class="batch-title">Batch {{ batch.number }}</span>
      <code class="method">{{ batch.method }}</code>
      <code class="path" :title="batch.url">{{ path }}</code>
      <span class="summary">{{ summary }}</span>
      <span class="using">
        <span class="using-label">using</span>
        <code v-for="urn in batch.using" :key="urn" class="urn" :title="urn">{{
          shortUrn(urn)
        }}</code>
      </span>
    </header>

    <RawJson v-if="rawJson" :batch="batch" />

    <div v-else ref="callsElement" class="calls" :style="{ paddingLeft: `${GUTTER + 6}px` }">
      <svg class="connectors" aria-hidden="true">
        <defs>
          <marker
            :id="`arrow-${batch.key}`"
            viewBox="0 0 6 6"
            refX="5"
            refY="3"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 6 3 L 0 6 z" class="arrow" />
          </marker>
        </defs>
        <path
          v-for="connector in connectors"
          :key="connector.key"
          :d="connector.d"
          class="connector"
          :marker-end="`url(#arrow-${batch.key})`"
        />
      </svg>

      <section
        v-for="call in batch.calls"
        :key="call.label"
        class="call"
        :class="{ highlighted: highlighted?.has(call.label) }"
        @mouseenter="emit('hoverCall', call.label)"
        @mouseleave="emit('hoverCall', undefined)"
      >
        <div class="call-header">
          <span class="label" :data-call="call.label">{{ call.label }}</span>
          <code class="call-name">{{ call.name }}</code>
          <code class="call-id">{{ call.callId }}</code>
          <span v-if="call.referencedBy.length" class="referenced-by">
            Referenced by {{ call.referencedBy.join(", ") }}
          </span>
          <span v-if="callSites?.[call.label]" class="location">
            {{ FILE_NAME }}:{{ callSites[call.label]!.start.line }}
          </span>
        </div>
        <dl class="args">
          <template v-for="arg in call.args" :key="arg.key">
            <dt :class="{ 'reference-key': arg.reference }">{{ arg.key }}</dt>
            <dd v-if="arg.reference" :data-ref="`${call.label}${arg.key}`">
              <span class="reference-chip" :title="`resultOf ${arg.reference.resultOf}`">
                ← {{ arg.reference.label ?? arg.reference.resultOf }} {{ arg.reference.name }}
              </span>
              <span class="reference-path"
                >path <code>{{ JSON.stringify(arg.reference.path) }}</code></span
              >
            </dd>
            <dd v-else>
              <code class="value">{{ compactJson(arg.value) }}</code>
              <span v-if="arg.fromSession" class="session-tag">filled from Session</span>
            </dd>
          </template>
        </dl>
      </section>
    </div>
  </article>
</template>

<style scoped>
.batch {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
  overflow: hidden;
}

.batch-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-size: 13px;
}

.batch-title {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.method {
  padding: 0 6px;
  border-radius: 4px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 12px;
  font-weight: 600;
}

.path {
  color: var(--vp-c-text-1);
}

.summary {
  color: var(--vp-c-text-2);
}

.using {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  color: var(--vp-c-text-2);
}

.urn {
  padding: 0 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  font-size: 12px;
  color: var(--vp-c-text-1);
}

.calls {
  position: relative;
  padding: 4px 12px 8px;
}

.connectors {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
  pointer-events: none;
}

.connector {
  fill: none;
  stroke: var(--vp-c-tip-1);
  stroke-width: 1.5;
}

.arrow {
  fill: var(--vp-c-tip-1);
}

.call {
  padding: 8px 0;
}

.call.highlighted {
  margin: 0 -12px 0 -6px;
  padding: 8px 12px 8px 6px;
  background: var(--vp-c-brand-soft);
  box-shadow: inset 2px 0 var(--vp-c-brand-1);
}

.location {
  margin-left: auto;
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.referenced-by + .location {
  margin-left: 8px;
}

.call + .call {
  border-top: 1px dashed var(--vp-c-divider);
}

.call-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
}

.label {
  padding: 0 6px;
  border-radius: 4px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  font-weight: 600;
}

.call-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.call-id {
  font-size: 12px;
  color: var(--vp-c-text-3);
}

.referenced-by {
  margin-left: auto;
  font-size: 13px;
  color: var(--vp-c-tip-1);
}

.args {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 2px 16px;
  margin: 6px 0 0;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
}

.args dt {
  color: var(--vp-c-tip-1);
}

.args dd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
  min-width: 0;
}

.value {
  overflow-wrap: anywhere;
  color: var(--vp-c-text-1);
}

.session-tag {
  padding: 0 6px;
  border: 1px dashed var(--vp-c-text-3);
  border-radius: 4px;
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  color: var(--vp-c-text-2);
}

.reference-chip {
  padding: 0 8px;
  border-radius: 999px;
  background: var(--vp-c-tip-1);
  color: var(--vp-c-bg);
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  font-weight: 600;
}

.reference-path {
  color: var(--vp-c-text-2);
}

.reference-path code {
  color: var(--vp-c-text-1);
}
</style>
