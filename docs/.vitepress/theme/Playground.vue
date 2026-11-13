<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";

import homeRequest from "../../snippets/home-request.md?raw";
import type { PlaygroundEditor } from "../playground/editor.ts";
import { firstTypeScriptFence } from "../playground/example.ts";
import type { RunnerMessage } from "../playground/messages.ts";
import type { RecordedRequest } from "../recorder/index.ts";

const initialCode = firstTypeScriptFence(homeRequest);
// How long typing must pause before the code runs again
const debounceMs = 300;

const code = ref(initialCode);
const editorContainer = ref<HTMLElement>();
const editor = shallowRef<PlaygroundEditor>();
const editorError = ref<string>();
const recorded = ref<RecordedRequest[]>([]);
const waiting = ref(false);
const error = ref<string>();
const worker = shallowRef<Worker>();
const kindLabels: Record<RecordedRequest["kind"], string> = {
  session: "Session",
  request: "JMAP Request",
  upload: "Upload",
  download: "Download",
  eventSource: "Event stream",
  unknown: "Request",
};

const entries = computed(() =>
  recorded.value.map((request) => ({ request, body: formatBody(request.body) })),
);

let debounce: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

function formatBody(body: unknown): string | undefined {
  if (body === undefined) return undefined;
  return typeof body === "string" ? body : JSON.stringify(body, null, 2);
}

function start(nextCode: string): void {
  worker.value?.terminate();
  recorded.value = [];
  waiting.value = false;
  error.value = undefined;

  const next = new Worker(new URL("../playground/worker.ts", import.meta.url), {
    type: "module",
  });
  worker.value = next;
  // A worker that was replaced may still deliver its last messages
  const isCurrent = () => worker.value === next;
  next.addEventListener("message", (event: MessageEvent<RunnerMessage>) => {
    if (!isCurrent()) return;
    const message = event.data;
    if (message.type === "request") {
      recorded.value.push(message.request);
      waiting.value = false;
    } else if (message.type === "waiting") {
      waiting.value = true;
    } else {
      error.value = message.message;
      waiting.value = false;
    }
  });
  next.addEventListener("error", (event) => {
    if (!isCurrent()) return;
    error.value = event.message || "The playground worker failed to start.";
    waiting.value = false;
  });
  // oxlint-disable-next-line unicorn/require-post-message-target-origin -- workers have no target origin
  next.postMessage({ code: nextCode });
}

function updateCode(next: string): void {
  code.value = next;
  if (debounce !== undefined) clearTimeout(debounce);
  debounce = setTimeout(() => start(next), debounceMs);
}

onMounted(async () => {
  start(code.value);

  // Monaco and its workers load only once the playground mounts
  try {
    const { createMonacoEditor } = await import("../playground/monaco.ts");
    if (disposed) return;
    const created = createMonacoEditor({ container: editorContainer.value!, code: code.value });
    created.onChange(updateCode);
    editor.value = created;
  } catch (failure) {
    editorError.value = failure instanceof Error ? failure.message : String(failure);
  }
});

onBeforeUnmount(() => {
  disposed = true;
  if (debounce !== undefined) clearTimeout(debounce);
  editor.value?.dispose();
  worker.value?.terminate();
});
</script>

<template>
  <div class="playground">
    <section class="pane editor-pane">
      <h2 class="pane-label">TypeScript</h2>
      <div class="editor-frame">
        <div ref="editorContainer" class="editor" />
        <p v-if="!editor && !editorError" class="editor-status" aria-live="polite">
          Loading editor…
        </p>
      </div>
      <p v-if="editorError" class="editor-status" aria-live="polite">{{ editorError }}</p>
    </section>

    <section class="pane requests-pane">
      <h2 class="pane-label">Requests</h2>

      <p v-if="!entries.length && !waiting && !error" class="status">Running…</p>

      <article v-for="(entry, index) in entries" :key="index" class="request">
        <header class="request-header">
          <span class="kind">{{ kindLabels[entry.request.kind] }}</span>
          <span class="method">{{ entry.request.method }}</span>
          <code class="url">{{ entry.request.url }}</code>
        </header>
        <pre v-if="entry.body !== undefined" class="body">{{ entry.body }}</pre>
      </article>

      <p v-if="waiting" class="status" aria-live="polite">Waiting for a response</p>
      <pre v-if="error" class="error" aria-live="polite">{{ error }}</pre>
    </section>
  </div>
</template>

<style scoped>
.playground {
  display: grid;
  gap: 24px;
}

@media (min-width: 960px) {
  .playground {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}

.pane {
  min-width: 0;
  padding: 16px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.pane-label {
  margin: 0 0 12px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.editor-frame {
  position: relative;
}

.editor {
  height: 480px;
  overflow: hidden;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
}

.editor:focus-within {
  border-color: var(--vp-c-brand-1);
  outline: 2px solid var(--vp-c-brand-soft);
}

.editor-status {
  margin: 16px 0 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}

.editor-frame .editor-status {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  pointer-events: none;
}

.requests-pane {
  min-height: 480px;
}

.request + .request {
  margin-top: 16px;
}

.request-header {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: baseline;
}

.kind {
  padding: 2px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  border-radius: 999px;
}

.method {
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  font-weight: 600;
}

.url {
  min-width: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.body,
.error {
  margin: 8px 0 0;
  padding: 12px;
  overflow: auto;
  font-family: var(--vp-font-family-mono);
  font-size: 12px;
  line-height: 1.6;
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-border);
  border-radius: 6px;
}

.error {
  color: var(--vp-c-danger-1);
  border-color: var(--vp-c-danger-1);
}

.status {
  margin: 16px 0 0;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
</style>
