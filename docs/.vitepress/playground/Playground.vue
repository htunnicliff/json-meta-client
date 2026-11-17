<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

import type { RecordedRequest, RecordedResponse } from "../recorder/index.ts";
import { codeOptions } from "./code-options.ts";
import { loadCode, saveCode } from "./code-storage.ts";
import ConnectDialog from "./ConnectDialog.vue";
import { forgetConnection, loadConnection, saveConnection } from "./connection-storage.ts";
import ConsolePanel from "./ConsolePanel.vue";
import type { ConsoleLine } from "./ConsolePanel.vue";
import type { CodeEditor } from "./editor.ts";
import { examples, findExample } from "./examples.ts";
import type { SourceInfo, Trace } from "./instrument.ts";
import OptionsMenu from "./OptionsMenu.vue";
import type { Connection, Diagnostic } from "./protocol.ts";
import { createRunner } from "./runner.ts";
import type { Runner, RunnerEvent } from "./runner.ts";
import { labelsAt, sourceLines } from "./source-lines.ts";
import { loadOptions, saveOptions } from "./stored-options.ts";
import { timelineOptions } from "./timeline-options.ts";
import { buildTimeline } from "./timeline.ts";
import type { RunStatus } from "./timeline.ts";
import TimelinePanel from "./TimelinePanel.vue";

/**
 * What the panel shows of a run
 */
interface RunView {
  requests: RecordedRequest[];
  diagnostics: Diagnostic[];
  errors: string[];
  logs: ConsoleLine[];
  /** Responses by request index: placeholder Sessions, and those from a connected server */
  responses: (RecordedResponse | undefined)[];
  status: RunStatus;
  /** The code the run ran */
  code: string;
  source?: SourceInfo;
  trace?: Trace;
}

const emptyView = (code: string, status: RunStatus): RunView => ({
  requests: [],
  diagnostics: [],
  errors: [],
  logs: [],
  responses: [],
  status,
  code,
});

const code = ref(loadCode());
watch(code, saveCode);
const view = shallowRef<RunView>(emptyView(code.value, "ready"));
const editorHost = ref<HTMLElement>();
const shownInTimeline = ref(loadOptions(timelineOptions));
watch(shownInTimeline, (chosen) => saveOptions(timelineOptions, chosen));
const codeChoices = ref(loadOptions(codeOptions));

// The console's share of the column it shares with the code, on wide screens
const CONSOLE_SHARE_KEY = "json-meta-client:playground:console-share";
const DEFAULT_CONSOLE_SHARE = 0.25;
const MIN_CONSOLE_SHARE = 0.1;
const MAX_CONSOLE_SHARE = 0.75;
const clampShare = (share: number) =>
  Math.min(MAX_CONSOLE_SHARE, Math.max(MIN_CONSOLE_SHARE, share));

function loadConsoleShare(): number {
  try {
    const stored = Number(localStorage.getItem(CONSOLE_SHARE_KEY));
    return stored ? clampShare(stored) : DEFAULT_CONSOLE_SHARE;
  } catch {
    return DEFAULT_CONSOLE_SHARE;
  }
}

const consoleShare = ref(loadConsoleShare());
watch(consoleShare, (share) => {
  try {
    localStorage.setItem(CONSOLE_SHARE_KEY, String(share));
  } catch {
    // Storage can be unavailable; the size lasts the visit
  }
});
const codePane = ref<HTMLElement>();
const consolePane = ref<HTMLElement>();
const resizing = ref(false);

// Drag the handle between the code and the console to share the column
function startResize(event: PointerEvent) {
  if (event.button !== 0 || !codePane.value || !consolePane.value) return;
  event.preventDefault();
  const handle = event.currentTarget as HTMLElement;
  const top = codePane.value.getBoundingClientRect().top;
  const bottom = consolePane.value.getBoundingClientRect().bottom;
  const room = bottom - top - handle.offsetHeight;
  if (room <= 0) return;
  handle.setPointerCapture(event.pointerId);
  resizing.value = true;
  const move = (moved: PointerEvent) => {
    consoleShare.value = clampShare((bottom - moved.clientY - handle.offsetHeight / 2) / room);
  };
  const end = () => {
    resizing.value = false;
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", end);
    handle.removeEventListener("pointercancel", end);
  };
  handle.addEventListener("pointermove", move);
  handle.addEventListener("pointerup", end);
  handle.addEventListener("pointercancel", end);
}

// Arrow keys move the handle; Home and End go to the limits
function resizeByKey(event: KeyboardEvent) {
  const step = event.shiftKey ? 0.1 : 0.05;
  const next: Record<string, number> = {
    ArrowUp: consoleShare.value + step,
    ArrowDown: consoleShare.value - step,
    Home: MAX_CONSOLE_SHARE,
    End: MIN_CONSOLE_SHARE,
  };
  if (!(event.key in next)) return;
  event.preventDefault();
  consoleShare.value = clampShare(next[event.key]!);
}
watch(codeChoices, (chosen) => {
  saveOptions(codeOptions, chosen);
  editor?.setLineWrapping(chosen.wrapLines);
});
let editor: CodeEditor | undefined;
let runner: Runner | undefined;
let unmounted = false;

function update(change: (current: RunView) => Partial<RunView>) {
  view.value = { ...view.value, ...change(view.value) };
}

function onEvent(event: RunnerEvent) {
  switch (event.type) {
    case "start":
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
      break;
    case "diagnostics":
      update(() => ({ diagnostics: event.diagnostics, status: "failed" }));
      break;
    case "error":
      update(({ errors, logs }) => ({
        // Calls of one Batch fail together, often with the same error
        errors: errors.includes(event.message) ? errors : [...errors, event.message],
        logs: [...logs, { level: "error", text: event.message }],
        status: "failed",
      }));
      break;
    case "compiled":
      update(() => ({ source: event.source }));
      break;
    case "trace":
      update(() => ({ trace: event.trace }));
      break;
    case "response":
      update(({ responses }) => {
        const copy = [...responses];
        copy[event.index] = event.response;
        return { responses: copy };
      });
      break;
    case "console":
      update(({ logs }) => ({ logs: [...logs, { level: event.level, text: event.text }] }));
      break;
  }
}

// A real server: in memory only, unless the user chose to remember it
const connection = shallowRef<Connection | undefined>(loadConnection());
const connecting = ref(false);
const server = computed(() => {
  try {
    return connection.value && new URL(connection.value.sessionUrl).host;
  } catch {
    return connection.value?.sessionUrl;
  }
});

// Show in the editor what fills in the code's placeholders
function showPlaceholderFill() {
  const current = connection.value;
  editor?.setPlaceholderFill(
    current && {
      sessionUrl: current.sessionUrl,
      credentials: typeof current.auth === "string" ? "token" : "password",
    },
  );
}
watch(connection, showPlaceholderFill);

function formatNow() {
  void editor?.format();
}

/**
 * Run the code, formatting it first when the user runs it and chose to
 */
async function run({ byUser = true } = {}) {
  if (byUser && codeChoices.value.formatOnRun) await editor?.format();
  view.value = emptyView(code.value, "running");
  runner?.run(code.value, connection.value);
}

function connect(chosen: Connection, remember: boolean) {
  connecting.value = false;
  connection.value = chosen;
  if (remember) saveConnection(chosen);
  else forgetConnection();
  runner?.stop();
  // Results of a request-only run don't apply to the server
  view.value = emptyView(code.value, "ready");
}

function disconnect() {
  // Dropping the reference and the worker that held a copy forgets the credentials
  connection.value = undefined;
  forgetConnection();
  runner?.stop();
  view.value = emptyView(code.value, "ready");
}

function onRunShortcut(event: KeyboardEvent) {
  if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey)) return;
  event.preventDefault();
  event.stopPropagation();
  void run();
}

const example = computed(() => findExample(code.value));

function chooseExample(id: string) {
  const chosen = examples.find((candidate) => candidate.id === id);
  if (!chosen || !editor) return;
  editor.setCode(chosen.code);
  if (!connection.value) void run({ byUser: false });
}

// Whether the code was edited since the last run
const stale = computed(() => view.value.code !== code.value);
const status = computed<RunStatus>(() => (stale.value ? "ready" : view.value.status));

// Where the method calls were made, while the code shown is the code that ran
const lines = computed(() => {
  const { source, trace, requests } = view.value;
  if (!source || !trace || stale.value) return undefined;
  const calls = buildTimeline(requests).flatMap((entry) =>
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
watch([panelHovered, lines], ([label, current]) => {
  const range = label ? current?.calls[label] : undefined;
  editor?.highlight(range ? [{ from: range.start.line, to: range.end.line }] : []);
});

onMounted(async () => {
  addEventListener("keydown", onRunShortcut, true);
  const [{ createEditor }, { startTypeScriptWorker }] = await Promise.all([
    import("./editor.ts"),
    import("./ts-worker.ts"),
  ]);
  if (unmounted || !editorHost.value) return;
  const worker = startTypeScriptWorker();
  runner = createRunner((source) => worker.compile(source), onEvent);
  editor = createEditor(editorHost.value, {
    code: code.value,
    worker,
    onChange: (value) => (code.value = value),
    onHover: (position) => {
      editorHovered.value = position && lines.value ? labelsAt(lines.value, position) : [];
    },
  });
  showPlaceholderFill();
  editor.setLineWrapping(codeChoices.value.wrapLines);
  // Code runs against a real server only when the user asks
  if (!connection.value) void run({ byUser: false });
});

onBeforeUnmount(() => {
  unmounted = true;
  removeEventListener("keydown", onRunShortcut, true);
  connection.value = undefined;
  runner?.stop();
  editor?.destroy();
});
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
      <button type="button" class="button run" @click="run()">▶ Run <kbd>⌘↵</kbd></button>
      <span
        v-if="connection"
        class="connected"
        title="Fills in <server> and <token> in your code's client options"
      >
        <strong>Connected</strong> · {{ server }}
        <button type="button" class="disconnect" @click="disconnect">Disconnect</button>
      </span>
      <button v-else type="button" class="button connect" @click="connecting = true">
        Connect a server…
      </button>
    </div>
    <ConnectDialog v-if="connecting" @connect="connect" @close="connecting = false" />
    <div
      class="panes"
      :class="{ resizing }"
      :style="{ '--code-share': `${1 - consoleShare}fr`, '--console-share': `${consoleShare}fr` }"
    >
      <section ref="codePane" class="pane code-pane" aria-label="Code">
        <header class="pane-header">
          playground.ts
          <OptionsMenu v-model="codeChoices" :set="codeOptions" title="Editor">
            <template #actions="{ close }">
              <button
                type="button"
                @click="
                  close();
                  formatNow();
                "
              >
                Format now <kbd>⇧⌥F</kbd>
              </button>
            </template>
          </OptionsMenu>
        </header>
        <div ref="editorHost" class="editor" />
      </section>

      <section class="pane requests-pane" aria-label="Output">
        <header class="pane-header">
          Requests
          <OptionsMenu v-model="shownInTimeline" :set="timelineOptions" title="Timeline" />
        </header>
        <div class="output" aria-live="polite">
          <TimelinePanel
            :requests="view.requests"
            :responses="view.responses"
            :connected="server"
            :status="status"
            :errors="view.errors"
            :diagnostics="view.diagnostics"
            :lines="lines"
            :highlighted="highlighted"
            :options="shownInTimeline"
            @hover-call="panelHovered = $event"
          />
        </div>
      </section>

      <div
        class="split"
        role="separator"
        aria-orientation="horizontal"
        aria-label="Console height"
        aria-valuemin="10"
        aria-valuemax="75"
        :aria-valuenow="Math.round(consoleShare * 100)"
        tabindex="0"
        title="Drag to resize the console; double-click to reset"
        @pointerdown="startResize"
        @keydown="resizeByKey"
        @dblclick="consoleShare = DEFAULT_CONSOLE_SHARE"
      />

      <section ref="consolePane" class="pane console-pane" aria-label="Console">
        <header class="pane-header">
          Console
          <span v-if="view.logs.length" class="count">{{ view.logs.length }}</span>
        </header>
        <div class="output">
          <ConsolePanel :logs="view.logs" />
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* As wide as the nav bar's content, centered on wide screens */
.playground {
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-sizing: border-box;
  width: 100%;
  max-width: var(--vp-layout-max-width);
  margin: 0 auto;
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
  font-weight: 500;
}

.run {
  background: var(--vp-c-brand-1);
  color: var(--vp-c-white);
}

.run:hover {
  background: var(--vp-c-brand-2);
}

.run kbd {
  margin-left: 4px;
  font-family: inherit;
  font-size: 12px;
  opacity: 0.8;
}

.connect {
  margin-left: auto;
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}

.connected {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  font-size: 13px;
  color: var(--vp-c-text-2);
}

.disconnect {
  padding: 2px 10px;
  border-radius: 8px;
  background: var(--vp-button-alt-bg);
  color: var(--vp-c-text-1);
  font-size: 12px;
}

/* Narrow: code, requests, console. Wide: the console under the code, the requests beside both. */
.panes {
  display: grid;
  flex: 1;
  grid-template-areas: "code" "requests" "console";
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
  min-height: 0;
}

.code-pane {
  grid-area: code;
}

.requests-pane {
  grid-area: requests;
}

.console-pane {
  grid-area: console;
}

@media (min-width: 960px) {
  .playground {
    height: calc(100vh - var(--vp-nav-height));
    padding-inline: 32px;
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
  gap: 8px;
  min-height: 40px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-size: 13px;
  font-weight: 600;
}

.count {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 10px;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  text-align: center;
}

/* Short and scrolling, so the code and requests keep the room */
.console-pane {
  flex: none;
  min-height: 0;
  height: clamp(96px, 22vh, 240px);
}

.editor {
  flex: 1;
  min-height: 320px;
  overflow: hidden;
}

.output {
  flex: 1;
  overflow: auto;
  padding: 12px;
}

.split {
  display: none;
}

/*
 * Wide: the code and the console share the left column, split by a handle
 * in the gap between them that moves the split
 */
@media (min-width: 960px) {
  .panes {
    grid-template-areas:
      "code requests"
      "split requests"
      "console requests";
    grid-template-rows: minmax(0, var(--code-share)) 16px minmax(0, var(--console-share));
    row-gap: 0;
  }

  .code-pane,
  .console-pane,
  .editor {
    min-height: 0;
  }

  .console-pane {
    height: auto;
  }

  .split {
    display: grid;
    grid-area: split;
    place-items: center;
    cursor: row-resize;
    touch-action: none;
  }

  .split::after {
    content: "";
    width: 32px;
    height: 4px;
    border-radius: 2px;
    background: var(--vp-c-divider);
    transition: background-color 0.15s;
  }

  .split:hover::after,
  .split:focus-visible::after,
  .resizing .split::after {
    background: var(--vp-c-brand-1);
  }

  .split:focus-visible {
    outline: none;
  }

  .resizing {
    cursor: row-resize;
    user-select: none;
  }
}
</style>

<style>
/* CodeMirror, on the docs site's code colors; it renders outside this component's scope */
.playground .cm-editor {
  height: 100%;
  font-size: 14px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.playground .cm-editor.cm-focused {
  outline: none;
}

.playground .cm-scroller {
  font-family: var(--vp-font-family-mono);
  line-height: 1.6;
}

.playground .cm-gutters {
  border-right: none;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-3);
}

.playground .cm-activeLine,
.playground .cm-activeLineGutter {
  background: transparent;
}

.playground .cm-content {
  caret-color: var(--vp-c-text-1);
}

.playground .pg-hovered-line {
  background: var(--vp-c-brand-soft);
  box-shadow: inset 3px 0 var(--vp-c-brand-1);
}

/* `<server>` and `<token>`, and what fills them in */
.playground .pg-placeholder {
  text-decoration: underline dotted var(--vp-c-warning-1);
  text-underline-offset: 3px;
  cursor: help;
}

.playground .pg-fill {
  margin-left: 6px;
  padding: 0 6px;
  border-radius: 4px;
  background: var(--vp-c-tip-soft);
  color: var(--vp-c-tip-1);
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  cursor: help;
}

.playground .tok-keyword,
.playground .tok-operatorKeyword {
  color: var(--vp-c-brand-1);
}

.playground .tok-string,
.playground .tok-string2 {
  color: var(--vp-c-tip-1);
}

.playground .tok-number,
.playground .tok-bool {
  color: var(--vp-c-green-1);
}

/* JSON in the output pane: keys stay plain, punctuation recedes */
.playground .raw .tok-punctuation {
  color: var(--vp-c-text-3);
}

.playground .tok-comment {
  color: var(--vp-c-text-3);
  font-style: italic;
}

.playground .tok-typeName,
.playground .tok-className {
  color: var(--vp-c-purple-1, var(--vp-c-indigo-1));
}

.playground .cm-tooltip {
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
}

.playground .cm-tooltip-autocomplete > ul > li[aria-selected] {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
}
</style>
