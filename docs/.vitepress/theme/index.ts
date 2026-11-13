// oxlint-disable import/no-unassigned-import
import type { Theme } from "vitepress";
import DefaultTheme from "vitepress/theme";
// https://vitepress.dev/guide/custom-theme
import { defineAsyncComponent, h } from "vue";

import HomeRequest from "./HomeRequest.vue";

import "virtual:group-icons.css";
import "./style.css";

export default {
  extends: DefaultTheme,
  Layout: () => {
    return h(DefaultTheme.Layout, null, {
      // https://vitepress.dev/guide/extending-default-theme#layout-slots
      "home-features-after": () => h(HomeRequest),
    });
  },
  enhanceApp({ app }) {
    // The playground's layout and its worker load only on the page that asks
    // for this layout
    app.component(
      "playground",
      defineAsyncComponent(() => import("./PlaygroundLayout.vue")),
    );
  },
} satisfies Theme;
