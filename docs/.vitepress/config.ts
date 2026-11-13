import { defineConfig } from "vitepress";
import { groupIconMdPlugin, groupIconVitePlugin } from "vitepress-plugin-group-icons";

import { syncJmapRequests } from "./plugins/jmap-request-tabs/index.ts";
import { playgroundDeclarations } from "./plugins/playground-declarations/index.ts";

// Fails when a generated JMAP Request fence is out of date
await syncJmapRequests({ write: false });

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "json-meta-client",
  description: "A JMAP client compatible with Node.js and the browser",
  lastUpdated: true,
  lang: "en-US",
  cleanUrls: true,
  // Snippets are included by other pages, not published on their own.
  srcExclude: ["snippets/**"],
  sitemap: {
    hostname: "https://json-meta-client.dev",
  },
  themeConfig: {
    externalLinkIcon: true,
    search: {
      provider: "local",
    },
    lastUpdated: {
      formatOptions: {
        dateStyle: "long",
        timeStyle: "short",
        localeMatcher: "best fit",
      },
    },
    editLink: {
      pattern: "https://github.com/htunnicliff/json-meta-client/edit/main/docs/:path",
    },
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: "Getting Started", link: "/getting-started" },
      { text: "API Reference", link: "/reference/api" },
      { text: "Playground", link: "/playground" },
      { text: "JMAP Standard", link: "https://jmap.io/" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Introduction", link: "/getting-started" },
          { text: "Best Practices", link: "/best-practices" },
          { text: "Testing", link: "/testing" },
          { text: "Examples", link: "/examples" },
        ],
      },
      {
        text: "Features",
        items: [
          { text: "Method Calls", link: "/features/method-calls" },
          { text: "Capabilities", link: "/features/capabilities" },
          { text: "Events", link: "/features/events" },
          { text: "Blobs", link: "/features/blobs" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API", link: "/reference/api" },
          { text: "Capabilities", link: "/reference/capabilities" },
          { text: "Errors", link: "/reference/errors" },
          { text: "Types", link: "/reference/types" },
          { text: "RFCs", link: "/reference/rfcs" },
        ],
      },
      {
        text: "Advanced",
        items: [
          { text: "Batching", link: "/advanced/batching" },
          { text: "Hooks", link: "/advanced/hooks" },
          { text: "Extending", link: "/advanced/extending" },
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
      message: "Released under the MPL-2.0 License.",
      copyright: "Copyright © 2026-present Hunter Tunnicliff",
    },
  },
  markdown: {
    config(md) {
      md.use(groupIconMdPlugin);
    },
  },
  vite: {
    plugins: [groupIconVitePlugin(), playgroundDeclarations()],
    // The playground worker dynamically imports the TypeScript compiler
    worker: {
      format: "es",
    },
  },
});
