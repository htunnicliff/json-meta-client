---
layout: page
sidebar: false
footer: false
title: Playground
description: Write code that uses json-meta-client and see the requests it sends.
---

<script setup>
import { defineAsyncComponent } from "vue";

// Loaded on this page only, with the workers it starts
const Playground = defineAsyncComponent(() => import("./.vitepress/playground/Playground.vue"));
</script>

<ClientOnly>
  <Playground />
</ClientOnly>
