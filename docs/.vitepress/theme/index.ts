// oxlint-disable import/no-unassigned-import
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
// https://vitepress.dev/guide/custom-theme
import { h } from "vue";

import HomeRequest from "./HomeRequest.vue";

import "virtual:group-icons.css";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
      "home-hero-after": () => h(HomeRequest),
    });
  },
  enhanceApp(_options) {
    // ...
  },
} satisfies Theme;
