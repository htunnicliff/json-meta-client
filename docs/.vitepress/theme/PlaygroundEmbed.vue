<script setup lang="ts">
import { defineAsyncComponent, onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import type { Component } from "vue";

/**
 * A live playground around a `ts` fence on a docs page. The fence stays in
 * the Markdown, so it is type-checked like any other example, and shows as is
 * until the embed scrolls into view and loads its editor and runner.
 *
 * ```md
 * <PlaygroundEmbed>
 *
 * ```ts
 * const { list } = await client.api.Mailbox.get({});
 * ```
 *
 * </PlaygroundEmbed>
 * ```
 */
const root = ref<HTMLElement>();
const code = ref("");
const Editor = shallowRef<Component>();
const ready = ref(false);
let observer: IntersectionObserver | undefined;

onMounted(() => {
  code.value = root.value?.querySelector("pre code")?.textContent?.replace(/\n$/, "") ?? "";
  observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some(({ isIntersecting }) => isIntersecting)) return;
      observer?.disconnect();
      Editor.value = defineAsyncComponent(() => import("../playground/embed/EmbedEditor.vue"));
    },
    { rootMargin: "200px" },
  );
  if (root.value) observer.observe(root.value);
});

onBeforeUnmount(() => observer?.disconnect());
</script>

<template>
  <div ref="root" class="playground-embed">
    <component :is="Editor" v-if="Editor && code" :initial-code="code" @ready="ready = true" />
    <div v-show="!ready"><slot /></div>
  </div>
</template>
