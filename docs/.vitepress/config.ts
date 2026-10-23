import { defineConfig } from "vitepress";
import { groupIconMdPlugin, groupIconVitePlugin } from "vitepress-plugin-group-icons";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "JSON Meta Client",
  description: "A JMAP client compatible with Node.js and the browser",
  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    nav: [],
    sidebar: [
      {
        text: "Introduction",
        items: [
          {
            text: "Getting Started",
            link: "/introduction/getting-started",
          },
          {
            text: "Examples",
            link: "/introduction/examples",
          },
        ],
      },
      {
        text: "Features",
        items: [
          {
            text: "Method Calls",
            link: "/features/method-calls",
          },
          {
            text: "Batching",
            link: "/features/batching",
          },
          {
            text: "Result References",
            link: "/features/result-references",
          },
          {
            text: "Capabilities",
            link: "/features/capabilities",
          },
          {
            text: "Events",
            link: "/features/events",
          },
          {
            text: "Blobs",
            link: "/features/blobs",
          },
          {
            text: "Hooks",
            link: "/features/hooks",
          },
        ],
      },
      {
        text: "Reference",
        items: [
          {
            text: "Configuration",
            link: "/reference/configuration",
          },
          {
            text: "Client API",
            link: "/reference/client-api",
          },
          {
            text: "Capability API",
            link: "/reference/capability-api",
          },
          {
            text: "Errors",
            link: "/reference/errors",
          },
          {
            text: "Types",
            link: "/reference/types",
          },
        ],
      },
    ],
    socialLinks: [
      {
        icon: "github",
        link: "https://github.com/htunnicliff/json-meta-client",
      },
    ],
    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright © 2026-present Hunter Tunnicliff",
    },
  },
  markdown: {
    config(md) {
      md.use(groupIconMdPlugin);
    },
  },
  vite: {
    plugins: [groupIconVitePlugin()],
  },
});
