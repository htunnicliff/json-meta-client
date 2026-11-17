<script setup lang="ts">
import { useData } from "vitepress";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

import type { RecordedRequest } from "../recorder/index.ts";
import type { CodeEditor } from "./editor.ts";
import { examples, findExample } from "./examples.ts";
import type { Diagnostic } from "./protocol.ts";
import { createRunner } from "./runner.ts";
import type { Runner, RunnerEvent } from "./runner.ts";
import type { RunStatus } from "./timeline.ts";
import TimelinePanel from "./TimelinePanel.vue";

// How long typing must pause before the code runs again
const RUN_DELAY_MS = 400;
// How long a new run's results wait to replace the last run's while it has not
// settled, so the panel does not flicker while typing
const SHOW_PARTIAL_AFTER_MS = 600;
// How long a run may stay busy before the panel suggests it is stuck
const STUCK_AFTER_MS = 3_000;

/**
 * What the panel shows of a run
 */
interface RunView {
  requests: RecordedRequest[];
  diagnostics: Diagnostic[];
  errors: string[];
  status: RunStatus;
}

const emptyView = (): RunView => ({ requests: [], diagnostics: [], errors: [], status: "running" });

const code = ref(examples[0]!.code);
const view = shallowRef<RunView>(emptyView());
const rawJson = ref(false);

const { isDark } = useData();
const editorHost = ref<HTMLElement>();
// The plain textarea stands in until Monaco loads
const editorReady = ref(false);
let editor: CodeEditor | undefined;
let unmounted = false;

let runner: Runner | undefined;
let runTimer: ReturnType<typeof setTimeout> | undefined;
let showTimer: ReturnType<typeof setTimeout> | undefined;
let stuckTimer: ReturnType<typeof setTimeout> | undefined;
// The latest run's view while it is not shown yet
let next: RunView | undefined;

function show() {
  clearTimeout(showTimer);
  if (next) view.value = next;
  next = undefined;
}

function update(change: (current: RunView) => Partial<RunView>) {
  if (next) next = { ...next, ...change(next) };
  else view.value = { ...view.value, ...change(view.value) };
}

function onEvent(event: RunnerEvent) {
  switch (event.type) {
    case "start":
      next = emptyView();
      clearTimeout(showTimer);
      showTimer = setTimeout(show, SHOW_PARTIAL_AFTER_MS);
      clearTimeout(stuckTimer);
      stuckTimer = setTimeout(() => {
        show();
        update(({ status }) => (status === "running" ? { status: "stuck" } : {}));
      }, STUCK_AFTER_MS);
      break;
    case "request":
      update(({ requests }) => {
        const copy = [...requests];
        copy[event.index] = event.request;
        return { requests: copy };
      });
      break;
    case "idle":
      update(() => ({ status: event.finished ? "finished" : "waiting" }));
      show();
      break;
    case "diagnostics":
      update(() => ({ diagnostics: event.diagnostics, status: "failed" }));
      show();
      break;
    case "error":
      update(({ errors }) => ({ errors: [...errors, event.message], status: "failed" }));
      show();
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

function setCode(value: string) {
  if (editor) editor.setCode(value);
  else code.value = value;
}

onMounted(async () => {
  runner = createRunner(onEvent);
  runNow();
  const { createMonacoEditor } = await import("./monaco-editor.ts");
  if (unmounted || !editorHost.value) return;
  editor = createMonacoEditor(editorHost.value, { code: code.value, dark: isDark.value });
  editor.onChange((value) => (code.value = value));
  editorReady.value = true;
});

onBeforeUnmount(() => {
  unmounted = true;
  clearTimeout(runTimer);
  clearTimeout(showTimer);
  clearTimeout(stuckTimer);
  runner?.dispose();
  editor?.dispose();
});

const example = computed(() => findExample(code.value));
const requestCount = computed(() => view.value.requests.filter(Boolean).length);

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

    <section class="pane output-pane" aria-label="Requests">
      <header class="pane-header">
        <span class="pane-title"> Requests <span class="count">{{ requestCount }}</span> </span>
        <label class="toggle">
          <input v-model="rawJson" type="checkbox" />
          Raw JSON
        </label>
      </header>
      <div class="output" aria-live="polite">
        <TimelinePanel
          :requests="view.requests"
          :status="view.status"
          :errors="view.errors"
          :diagnostics="view.diagnostics"
          :raw-json="rawJson"
          :example="example"
          @show-batched="setCode"
        />
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

.count {
  margin-left: 2px;
  font-weight: 400;
  color: var(--vp-c-text-2);
}

.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--vp-c-text-2);
  cursor: pointer;
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
</style>
