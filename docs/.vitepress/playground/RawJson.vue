<script setup lang="ts">
import { computed } from "vue";

import { annotateRequest, jsonLines } from "./timeline.ts";
import type { AnnotatedLine, BatchEntry, TokenKind } from "./timeline.ts";

const props = defineProps<{
  /** A JMAP Request, shown with notes on its method calls */
  batch?: BatchEntry;
  /** Any other JSON value, shown when there is no `batch` */
  body?: unknown;
  label: string;
  /** Labels of the method calls to highlight */
  highlighted?: ReadonlySet<string>;
}>();

const emit = defineEmits<{ hoverCall: [label: string | undefined] }>();

const lines = computed<AnnotatedLine[]>(() =>
  props.batch ? annotateRequest(props.batch) : jsonLines(props.body),
);

// The editor's highlight classes, so both panes share one color scheme
const tokenClasses: Record<TokenKind, string> = {
  key: "tok-propertyName",
  string: "tok-string",
  number: "tok-number",
  literal: "tok-bool",
  punctuation: "tok-punctuation",
};
</script>

<template>
  <div class="raw" role="region" :aria-label="label">
    <div
      v-for="(line, index) in lines"
      :key="index"
      class="line"
      :class="{ highlighted: line.call && highlighted?.has(line.call) }"
      @mouseenter="emit('hoverCall', line.call)"
      @mouseleave="emit('hoverCall', undefined)"
    >
      <span class="number">{{ index + 1 }}</span>
      <code class="text"
        ><span
          v-for="(token, tokenIndex) in line.tokens"
          :key="tokenIndex"
          :class="token.kind && tokenClasses[token.kind]"
          >{{ token.text }}</span
        ></code
      >
      <span v-if="line.note" class="note" :data-tone="line.note.tone">{{ line.note.text }}</span>
    </div>
  </div>
</template>

<style scoped>
.raw {
  padding: 8px 0;
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.6;
  overflow-x: auto;
}

.line {
  display: grid;
  grid-template-columns: 3ch max-content minmax(0, 1fr);
  align-items: center;
  gap: 12px;
  padding: 0 12px;
}

.line.highlighted {
  background: var(--vp-c-brand-soft);
}

.number {
  color: var(--vp-c-text-3);
  text-align: right;
  user-select: none;
}

.text {
  white-space: pre;
  color: var(--vp-c-text-1);
}

.note {
  justify-self: end;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
}

.note[data-tone="reference"] {
  background: var(--vp-c-tip-1);
  color: var(--vp-c-bg);
  font-family: var(--vp-font-family-base);
}

.note[data-tone="label"] {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
</style>
