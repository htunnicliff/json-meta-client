<script setup lang="ts">
import Example from "../../snippets/home-request.md";
</script>

<template>
  <section class="home-request">
    <div class="container">
      <h2 class="heading">Two calls, one request</h2>
      <p class="lede">
        Calls made together travel in a single JMAP request. The server passes the query's IDs
        straight to <code>Email/get</code>, so there is no second round trip.
      </p>
      <div class="vp-doc">
        <Example />
      </div>
    </div>
  </section>
</template>

<style scoped>
.home-request {
  padding: 0 24px;
  margin-top: 48px;
}

.container {
  max-width: 1152px;
  margin: 0 auto;
}

.heading {
  font-size: 24px;
  font-weight: 600;
  line-height: 32px;
  color: var(--vp-c-text-1);
}

.lede {
  margin: 8px 0 0;
  max-width: 640px;
  line-height: 24px;
  color: var(--vp-c-text-2);
}

.lede code {
  font-family: var(--vp-font-family-mono);
  font-size: 0.875em;
  color: var(--vp-c-text-1);
}

@media (min-width: 640px) {
  .home-request {
    padding: 0 48px;
  }
}

@media (min-width: 960px) {
  .home-request {
    padding: 0 64px;
    margin-top: 16px;
  }
}
</style>
