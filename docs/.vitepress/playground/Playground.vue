<script setup lang="ts">
import { useData } from "vitepress";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

import type { RecordedRequest } from "../recorder/index.ts";
import ConsolePanel from "./ConsolePanel.vue";
import type { ConsoleLine } from "./ConsolePanel.vue";
import { editorDecorations, labelsAt } from "./editor-decorations.ts";
import type { CodeEditor } from "./editor.ts";
import { examples, findExample } from "./examples.ts";
import type { SourceInfo, Trace } from "./instrument.ts";
import type { Diagnostic } from "./protocol.ts";
import { createRunner } from "./runner.ts";
import type { Runner, RunnerEvent } from "./runner.ts";
import { decodeShare, encodeShare } from "./share.ts";
import { sourceLines } from "./source-lines.ts";
import { buildTimeline } from "./timeline.ts";
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
  logs: ConsoleLine[];
  status: RunStatus;
  /** The code the run ran */
  code: string;
  source?: SourceInfo;
  trace?: Trace;
}

const emptyView = (): RunView => ({
  requests: [],
  diagnostics: [],
  errors: [],
  logs: [],
  status: "running",
  code: "",
});

const defaultCode = examples[0]!.code;
const code = ref(defaultCode);
const view = shallowRef<RunView>(emptyView());
const rawJson = ref(false);
const tab = ref<"requests" | "console">("requests");
// A message about the shared link, such as one that could not be read
const notice = ref("");
const shareStatus = ref("");

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
      next = { ...emptyView(), code: code.value };
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
      update(({ errors, logs }) => ({
        errors: [...errors, event.message],
        logs: [...logs, { level: "error", text: event.message }],
        status: "failed",
      }));
      show();
      break;
    case "compiled":
      update(() => ({ source: event.source }));
      break;
    case "trace":
      update(() => ({ trace: event.trace }));
      break;
    case "console":
      update(({ logs }) => ({ logs: [...logs, { level: event.level, text: event.text }] }));
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

/**
 * Load the code a shared link holds, if any
 */
async function loadFromHash() {
  const shared = await decodeShare(location.hash);
  if (shared.kind === "code") {
    notice.value = "";
    setCode(shared.code);
  } else if (shared.kind === "invalid") {
    notice.value = `The code in this link couldn't be read (${shared.reason}), so the default example is shown.`;
    setCode(defaultCode);
  }
}

function clearHash() {
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
}

let shareTimer: ReturnType<typeof setTimeout> | undefined;
async function share() {
  const hash = await encodeShare(code.value);
  history.replaceState(history.state, "", `#${hash}`);
  try {
    await navigator.clipboard.writeText(location.href);
    shareStatus.value = "Link copied";
  } catch {
    shareStatus.value = "Link in the address bar";
  }
  clearTimeout(shareTimer);
  shareTimer = setTimeout(() => (shareStatus.value = ""), 2_000);
}

function reset() {
  notice.value = "";
  clearHash();
  setCode(defaultCode);
}

function chooseExample(id: string) {
  const chosen = examples.find((candidate) => candidate.id === id);
  if (chosen) setCode(chosen.code);
}

const onHashChange = () => void loadFromHash();

onMounted(async () => {
  runner = createRunner(onEvent);
  await loadFromHash();
  runNow();
  addEventListener("hashchange", onHashChange);
  const { createMonacoEditor } = await import("./monaco-editor.ts");
  if (unmounted || !editorHost.value) return;
  editor = createMonacoEditor(editorHost.value, { code: code.value, dark: isDark.value });
  editor.onChange((value) => (code.value = value));
  editor.onHover((position) => {
    editorHovered.value = position && lines.value ? labelsAt(lines.value, position) : [];
  });
  editor.setDecorations(decorations.value);
  editorReady.value = true;
});

onBeforeUnmount(() => {
  unmounted = true;
  removeEventListener("hashchange", onHashChange);
  clearTimeout(shareTimer);
  clearTimeout(runTimer);
  clearTimeout(showTimer);
  clearTimeout(stuckTimer);
  runner?.dispose();
  editor?.dispose();
});

const example = computed(() => findExample(code.value));
const requestCount = computed(() => view.value.requests.filter(Boolean).length);
const logCount = computed(() => view.value.logs.length);

// Source lines, while the code shown is the code that ran: an edit clears them
// until the next run settles
const lines = computed(() => {
  const { source, trace, requests, code: ran } = view.value;
  if (!source || !trace || ran !== code.value) return undefined;
  const calls = buildTimeline(requests.filter(Boolean)).flatMap((entry) =>
    entry.kind === "batch" ? entry.calls : [],
  );
  return sourceLines(source, trace, calls);
});

// Method calls hovered in the panel, and those under the pointer in the editor
const panelHovered = ref<string>();
const editorHovered = ref<string[]>([]);
const highlighted = computed(
  () => new Set([...editorHovered.value, ...(panelHovered.value ? [panelHovered.value] : [])]),
);
watch(code, () => {
  panelHovered.value = undefined;
  editorHovered.value = [];
});

const decorations = computed(() =>
  lines.value
    ? editorDecorations(lines.value, new Set(panelHovered.value ? [panelHovered.value] : []))
    : [],
);
watch(decorations, (next) => editor?.setDecorations(next));

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
    <div class="toolbar">
      <label class="example">
        Example
        <select
          :value="example?.id ?? ''"
          @change="chooseExample(($event.target as HTMLSelectElement).value)"
        >
          <option v-if="!example" value="" disabled>Your code</option>
          <option v-for="option in examples" :key="option.id" :value="option.id">
            {{ option.title }}
          </option>
        </select>
      </label>
      <button type="button" class="button" @click="reset">Reset</button>
      <button type="button" class="button" @click="share">Share</button>
      <span class="share-status" role="status">{{ shareStatus }}</span>
      <span class="mode"><span class="mode-dot" />Request-only · re-runs as you type</span>
    </div>
    <p v-if="notice" class="notice" role="alert">
      {{ notice }}
      <button type="button" class="dismiss" aria-label="Dismiss" @click="notice = ''">×</button>
    </p>
    <div class="panes">
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

      <section class="pane output-pane" aria-label="Output">
        <header class="pane-header">
          <div class="tabs" role="tablist">
            <button
              type="button"
              role="tab"
              class="tab"
              :aria-selected="tab === 'requests'"
              @click="tab = 'requests'"
            >
              Requests <span class="count">{{ requestCount }}</span>
            </button>
            <button
              type="button"
              role="tab"
              class="tab"
              :aria-selected="tab === 'console'"
              @click="tab = 'console'"
            >
              Console <span v-if="logCount" class="count">{{ logCount }}</span>
            </button>
          </div>
          <label v-if="tab === 'requests'" class="toggle">
            <input v-model="rawJson" type="checkbox" />
            Raw JSON
          </label>
        </header>
        <div class="output" aria-live="polite">
          <ConsolePanel
            v-if="tab === 'console'"
            :lines="view.logs"
            :waiting="view.status === 'waiting'"
          />
          <TimelinePanel
            v-else
            :requests="view.requests"
            :status="view.status"
            :errors="view.errors"
            :diagnostics="view.diagnostics"
            :raw-json="rawJson"
            :example="example"
            :lines="lines"
            :highlighted="highlighted"
            @show-batched="setCode"
            @hover-call="panelHovered = $event"
          />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.playground {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px 16px;
  min-height: calc(100vh - var(--vp-nav-height));
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  font-size: 14px;
}

.example {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--vp-c-text-2);
}

.example select {
  padding: 4px 28px 4px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg)
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%23888' stroke-width='1.5'/%3E%3C/svg%3E")
    no-repeat right 10px center;
  appearance: none;
  color: var(--vp-c-text-1);
}

.button {
  padding: 4px 12px;
  border-radius: 8px;
  background: var(--vp-button-alt-bg);
  color: var(--vp-c-text-1);
  font-weight: 500;
}

.button:hover {
  background: var(--vp-button-alt-hover-bg);
}

.share-status {
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.mode {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  color: var(--vp-c-text-2);
  font-size: 13px;
}

.mode-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--vp-c-green-1);
}

.notice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--vp-c-warning-soft);
  color: var(--vp-c-warning-1);
  font-size: 14px;
}

.dismiss {
  font-size: 18px;
  line-height: 1;
  color: inherit;
}

.panes {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
}

@media (min-width: 960px) {
  .playground {
    height: calc(100vh - var(--vp-nav-height));
  }

  .panes {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
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

.tabs {
  display: flex;
  gap: 16px;
  margin: -8px 0;
}

.tab {
  padding: 8px 0 6px;
  border-bottom: 2px solid transparent;
  color: var(--vp-c-text-2);
  font-weight: 500;
}

.tab[aria-selected="true"] {
  border-bottom-color: var(--vp-c-brand-1);
  color: var(--vp-c-text-1);
  font-weight: 600;
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

<style>
/* Editor decorations; Monaco renders them outside this component's scope */
.monaco-editor .pg-not-reached {
  opacity: 0.4;
}

.monaco-editor .pg-waiting-line {
  background: var(--vp-c-yellow-soft);
  box-shadow: inset 3px 0 var(--vp-c-yellow-1);
}

.monaco-editor .pg-hovered-line {
  background: var(--vp-c-brand-soft);
  box-shadow: inset 3px 0 var(--vp-c-brand-1);
}

.monaco-editor .pg-badge {
  margin-left: 12px;
  padding: 0 6px;
  border-radius: 4px;
  font-family: var(--vp-font-family-base);
  font-size: 11px;
  font-weight: 600;
}

.monaco-editor .pg-badge-call {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
}

.monaco-editor .pg-badge-waiting {
  background: var(--vp-c-yellow-soft);
  color: var(--vp-c-yellow-1);
}

.monaco-editor .pg-badge-not-sent {
  border: 1px dashed var(--vp-c-text-3);
  color: var(--vp-c-text-2);
}
</style>
