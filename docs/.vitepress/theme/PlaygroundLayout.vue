<script setup lang="ts">
import Playground from "./Playground.vue";
</script>

<template>
  <div class="playground-layout">
    <header class="playground-header">
      <h1 class="playground-title">Playground</h1>
      <p class="playground-lede">
        Write TypeScript against the real library. Every request it makes appears here, and requests
        stay pending, so the code stops where it would wait for a server response.
      </p>
    </header>
    <Playground />
  </div>
</template>

<style scoped>
.playground-layout {
  max-width: 1152px;
  padding: 32px 24px 96px;
  margin: 0 auto;
}

.playground-title {
  margin: 0;
  font-size: 32px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--vp-c-text-1);
}

.playground-lede {
  max-width: 720px;
  margin: 12px 0 24px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

@media (min-width: 640px) {
  .playground-layout {
    padding-inline: 48px;
  }
}

@media (min-width: 960px) {
  .playground-layout {
    padding-inline: 64px;
  }
}
</style>
