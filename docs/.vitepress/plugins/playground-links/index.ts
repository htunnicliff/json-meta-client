import { deflateRawSync } from "node:zlib";

import type { MarkdownRenderer } from "vitepress";

import { PLAYGROUND_CODE_PARAM } from "../../playground/code-link.ts";
import { hasPlaygroundCode, playgroundCode } from "./playground-code.ts";

const isExample = (info: string) => /^(?:ts|typescript)\b/.test(info.trim());

/**
 * A link that opens the code in the playground, compressed into the URL's
 * fragment, which `code-link.ts` reads back. The fragment stays in the
 * browser, so the code is not sent to the server.
 */
export function playgroundHref(code: string): string {
  const encoded = deflateRawSync(code).toString("base64url");
  return `/playground#${PLAYGROUND_CODE_PARAM}=${encoded}`;
}

// Icon from Lucide (ISC license): square-play
const icon =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 8.5v7a.5.5 0 0 0 .75.43l6-3.5a.5.5 0 0 0 0-.86l-6-3.5A.5.5 0 0 0 9 8.5"/></svg>';

/**
 * Add an "Open in playground" link to each TypeScript fence that uses a
 * client. The link's code runs on its own: it constructs the docs' client
 * when the example uses it without constructing one, and stands in
 * placeholders for values that earlier examples on the page declared.
 */
export function playgroundLinks(md: MarkdownRenderer): void {
  md.core.ruler.push("playground-links", (state) => {
    const fences = state.tokens.filter((token) => token.type === "fence" && isExample(token.info));
    const examples = fences.map(({ content }) => ({ source: content }));
    fences.forEach((token, index) => {
      if (!hasPlaygroundCode(token.content)) {
        return;
      }
      token.meta = {
        ...token.meta,
        playgroundHref: playgroundHref(playgroundCode(examples, index)),
      };
    });
  });

  const fence = md.renderer.rules.fence!;
  md.renderer.rules.fence = (tokens, index, options, env, self) => {
    const html = fence(tokens, index, options, env, self);
    const meta: unknown = tokens[index]?.meta;
    const href =
      meta && typeof meta === "object" && "playgroundHref" in meta
        ? meta.playgroundHref
        : undefined;
    if (typeof href !== "string") {
      return html;
    }
    const link = `<a class="playground-link" href="${md.utils.escapeHtml(href)}" target="_blank" title="Open in playground" aria-label="Open in playground">${icon}</a>`;
    return html.replace("<pre", `${link}<pre`);
  };
}
