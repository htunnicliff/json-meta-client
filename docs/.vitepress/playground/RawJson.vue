<script setup lang="ts">
import { computed } from "vue";

import { annotateRequest } from "./timeline.ts";
import type { BatchEntry } from "./timeline.ts";

const props = defineProps<{ batch: BatchEntry }>();

const lines = computed(() => annotateRequest(props.batch));
</script>

<template>
  <div class="raw" role="region" aria-label="JMAP Request as sent">
    <div v-for="(line, index) in lines" :key="index" class="line" :data-tone="line.note?.tone">
      <span class="number">{{ index + 1 }}</span>
      <code class="text">{{ line.text }}</code>
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

.line[data-tone="reference"] {
  background: var(--vp-c-tip-soft);
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
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
}

.note[data-tone="session"] {
  border: 1px dashed var(--vp-c-text-3);
  color: var(--vp-c-text-2);
}

.note[data-tone="config"] {
  background: var(--vp-c-green-soft);
  color: var(--vp-c-green-1);
}

.note[data-tone="reference"] {
  background: var(--vp-c-tip-1);
  color: var(--vp-c-bg);
}

.note[data-tone="label"] {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-family: var(--vp-font-family-mono);
}
</style>
