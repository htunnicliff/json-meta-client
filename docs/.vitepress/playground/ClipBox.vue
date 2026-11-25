<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(
  defineProps<{
    /** Whether to clip at all */
    clip?: boolean;
    /** How many lines to show while collapsed */
    lines?: number;
  }>(),
  { clip: true, lines: 12 },
);

// Content only a few lines past the limit isn't worth a toggle
const SLACK_LINES = 3;

const box = ref<HTMLElement>();
const content = ref<HTMLElement>();
const overflowing = ref(false);
const expanded = ref(false);
let observer: ResizeObserver | undefined;

function measure() {
  if (!content.value) {
    return;
  }
  const lineHeight = parseFloat(getComputedStyle(content.value).lineHeight) || 20;
  overflowing.value = content.value.scrollHeight > (props.lines + SLACK_LINES) * lineHeight;
}

function toggle() {
  expanded.value = !expanded.value;
  // Collapsing can leave the pointer far below the box; bring it back
  if (!expanded.value) {
    box.value?.scrollIntoView({ block: "nearest" });
  }
}

onMounted(() => {
  measure();
  observer = new ResizeObserver(measure);
  if (content.value) {
    observer.observe(content.value);
  }
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div
    ref="box"
    class="clip"
    :class="{ clipped: clip && overflowing && !expanded, expanded }"
    :style="{ '--clip-lines': lines }"
  >
    <div ref="content" class="content"><slot /></div>
    <div v-if="clip && overflowing" class="toggle">
      <button type="button" class="pill" :aria-expanded="expanded" @click="toggle">
        {{ expanded ? "Show less" : "Show more" }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.clip {
  position: relative;
  /* The code blocks' own, so 1lh is one of their lines */
  font-size: 13px;
  line-height: 1.6;
}

.content {
  line-height: inherit;
}

.clipped .content {
  /* The lines, plus the vertical padding of the code blocks inside */
  max-height: calc(var(--clip-lines) * 1lh + 16px);
  overflow: hidden;
}

.clipped::after {
  content: "";
  position: absolute;
  inset: auto 0 0;
  height: 48px;
  border-radius: 0 0 6px 6px;
  background: linear-gradient(transparent, var(--vp-code-block-bg));
  pointer-events: none;
}

/* Sits over the bottom of the box */
.toggle {
  position: absolute;
  inset: auto 0 8px;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  height: 0;
  pointer-events: none;
}

/* While expanded, floats at the bottom of the scrolling pane until the box ends */
.expanded .toggle {
  position: sticky;
  bottom: 8px;
}

.expanded .pill {
  translate: 0 calc(-100% - 8px);
}

.pill {
  translate: 0 -100%;
  padding: 2px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-2);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-base);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
  pointer-events: auto;
}

.pill:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
</style>
