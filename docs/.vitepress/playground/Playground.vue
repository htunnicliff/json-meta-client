<script setup lang="ts">
import { useData } from "vitepress";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

import type { RecordedRequest } from "../recorder/index.ts";
import type { CodeEditor } from "./editor.ts";
import { defaultExample } from "./examples.ts";
import type { Diagnostic } from "./protocol.ts";
import { createRunner } from "./runner.ts";
import type { Runner, RunnerEvent } from "./runner.ts";

// How long typing must pause before the code runs again
const RUN_DELAY_MS = 400;
// How long a run may stay busy before the panel suggests it is stuck
const STUCK_AFTER_MS = 3_000;

type Status = "running" | "stuck" | "waiting" | "finished" | "failed";

const code = ref(defaultExample);
const requests = ref<RecordedRequest[]>([]);
const diagnostics = ref<Diagnostic[]>([]);
const errors = ref<string[]>([]);
const status = ref<Status>("running");

const { isDark } = useData();
const editorHost = ref<HTMLElement>();
// The plain textarea stands in until Monaco loads
const editorReady = ref(false);
let editor: CodeEditor | undefined;
let unmounted = false;

let runner: Runner | undefined;
let runTimer: ReturnType<typeof setTimeout> | undefined;
let stuckTimer: ReturnType<typeof setTimeout> | undefined;

function onEvent(event: RunnerEvent) {
  switch (event.type) {
    case "start":
      requests.value = [];
      diagnostics.value = [];
      errors.value = [];
      status.value = "running";
      clearTimeout(stuckTimer);
      stuckTimer = setTimeout(() => {
        if (status.value === "running") status.value = "stuck";
      }, STUCK_AFTER_MS);
      break;
    case "request": {
      const next = [...requests.value];
      next[event.index] = event.request;
      requests.value = next;
      break;
    }
    case "idle":
      status.value = event.finished ? "finished" : "waiting";
      break;
    case "diagnostics":
      diagnostics.value = event.diagnostics;
      status.value = "failed";
      break;
    case "error":
      errors.value = [...errors.value, event.message];
      status.value = "failed";
      break;
  }
}

function runNow() {
  clearTimeout(runTimer);
  runner?.run(code.value);
}

watch(code, () => {
  clearTimeout(runTimer);
  runTimer = setTimeout(runNow, RUN_DELAY_MS);
});

watch(isDark, (dark) => editor?.setDark(dark));

onMounted(async () => {
  runner = createRunner(onEvent);
  runNow();
  const { createMonacoEditor } = await import("./monaco-editor.ts");
  if (unmounted || !editorHost.value) return;
  editor = createMonacoEditor(editorHost.value, { code: code.value, dark: isDark.value });
  editor.onChange((next) => (code.value = next));
  editorReady.value = true;
});

onBeforeUnmount(() => {
  unmounted = true;
  clearTimeout(runTimer);
  clearTimeout(stuckTimer);
  runner?.dispose();
  editor?.dispose();
});

const recorded = computed(() => requests.value.filter(Boolean));

const statusText = computed(() => {
  switch (status.value) {
    case "running":
      return "Running…";
    case "stuck":
      return "Still running. The code may be in an infinite loop; editing it starts a new run.";
    case "waiting":
      return "Waiting for a response";
    case "finished":
      return recorded.value.length
        ? "Finished; requests stay pending"
        : "Finished without a request";
    case "failed":
      return "Stopped by an error";
  }
  return "";
});

const kindLabels: Record<RecordedRequest["kind"], string> = {
  session: "Session",
  request: "JMAP Request",
  upload: "Upload",
  download: "Download",
  eventSource: "Event stream",
  unknown: "Request",
};

function formatBody(body: unknown): string {
  return typeof body === "string" ? body : JSON.stringify(body, null, 2);
}

function onKeydown(event: KeyboardEvent) {
  // Indent with Tab rather than leaving the editor
  if (event.key !== "Tab" || event.shiftKey) return;
  event.preventDefault();
  const target = event.currentTarget as HTMLTextAreaElement;
  const { selectionStart, selectionEnd } = target;
  target.setRangeText("  ", selectionStart, selectionEnd, "end");
  code.value = target.value;
}
</script>

<template>
  <div class="playground">
    <section class="pane editor-pane" aria-label="Code">
      <header class="pane-header">
        <span class="pane-title">playground.ts</span>
      </header>
      <div v-show="editorReady" ref="editorHost" class="monaco-host" />
      <textarea
        v-if="!editorReady"
        v-model="code"
        class="editor"
        spellcheck="false"
        wrap="off"
        autocapitalize="off"
        autocomplete="off"
        aria-label="TypeScript code"
        @keydown="onKeydown"
      />
    </section>

    <section class="pane output-pane" aria-label="Requests" aria-live="polite">
      <header class="pane-header">
        <span class="pane-title">Requests</span>
        <span class="status" :data-status="status">{{ statusText }}</span>
      </header>
      <div class="output">
        <ul v-if="diagnostics.length" class="problems">
          <li v-for="(diagnostic, index) in diagnostics" :key="index">
            <span v-if="diagnostic.line" class="location"
              >playground.ts:{{ diagnostic.line }}:{{ diagnostic.column }}</span
            >
            {{ diagnostic.message }}
          </li>
        </ul>

        <ol class="requests">
          <li v-for="(request, index) in recorded" :key="index" class="request">
            <div class="request-line">
              <span class="kind">{{ kindLabels[request.kind] }}</span>
              <code class="method">{{ request.method }}</code>
              <code class="url">{{ request.url }}</code>
            </div>
            <pre
              v-if="request.body !== undefined"
              class="body"
            ><code>{{ formatBody(request.body) }}</code></pre>
          </li>
        </ol>

        <ul v-if="errors.length" class="problems">
          <li v-for="(error, index) in errors" :key="index">{{ error }}</li>
        </ul>

        <p v-if="status === 'waiting'" class="waiting">Waiting for a response</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.playground {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  padding: 16px;
  min-height: calc(100vh - var(--vp-nav-height));
}

@media (min-width: 960px) {
  .playground {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    height: calc(100vh - var(--vp-nav-height));
  }
}

.pane {
  display: flex;
  flex-direction: column;
  min-height: 320px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  overflow: hidden;
}

.pane-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-size: 13px;
}

.pane-title {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.status {
  color: var(--vp-c-text-2);
  text-align: right;
}

.status[data-status="failed"],
.status[data-status="stuck"] {
  color: var(--vp-c-danger-1);
}

.editor {
  flex: 1;
  width: 100%;
  min-height: 320px;
  padding: 12px;
  border: none;
  resize: none;
  font-family: var(--vp-font-family-mono);
  font-size: 14px;
  line-height: 1.6;
  tab-size: 2;
  white-space: pre;
  overflow: auto;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg);
}

.editor:focus {
  outline: none;
}

.monaco-host {
  flex: 1;
  min-height: 320px;
}

.output {
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.requests {
  margin: 0;
  padding: 0;
  list-style: none;
}

.request + .request {
  margin-top: 12px;
}

.request-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
}

.kind {
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.method {
  color: var(--vp-c-brand-1);
}

.url {
  overflow-wrap: anywhere;
  color: var(--vp-c-text-2);
}

.body {
  margin: 6px 0 0;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--vp-code-block-bg);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  line-height: 1.5;
  overflow-x: auto;
}

.problems {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 6px;
  list-style: none;
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
  font-family: var(--vp-font-family-mono);
  font-size: 13px;
  white-space: pre-wrap;
}

.requests + .problems {
  margin-top: 12px;
}

.location {
  font-weight: 600;
}

.waiting {
  margin: 12px 0 0;
  padding: 8px 12px;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 6px;
  color: var(--vp-c-text-2);
  font-size: 13px;
}
</style>
