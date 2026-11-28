import type { Plugin } from "vite";

import pkgData from "../../../pkg.data.ts";
import capabilitiesData from "../../../reference/capabilities.data.ts";
import type { BuiltInCapability } from "../../../reference/capabilities.data.ts";

const code = (text: string) => `\`${text}\``;
const list = (items: string[]) => items.map(code).join(", ");

/** One capability as Markdown, with the fields `CapabilityTable.vue` shows */
export function capabilityMarkdown(name: string, capability: BuiltInCapability): string {
  const withoutDefaultAccount = Object.entries(capability.defaultAccount ?? {})
    .filter(([, account]) => account === null)
    .map(([method]) => method);
  const methods = capability.entities
    .toSorted()
    .filter((entity) => capability.methods[entity])
    .map((entity) => `${code(entity)}: ${list(capability.methods[entity])}`);
  const fields = (details: BuiltInCapability["accountDetails"]) =>
    details.map((field) => code(`${field.name}${field.optional ? "?" : ""}: ${field.type}`));

  const rows = [
    `- URN: ${code(capability.urn)}`,
    `- Specification: [${capability.spec.title}](${capability.spec.url})`,
    capability.dependsOn && `- Also sends: ${list(capability.dependsOn)}`,
    capability.extends && `- Extends: ${code(capability.extends)}`,
    withoutDefaultAccount.length > 0 && `- No default account: ${list(withoutDefaultAccount)}`,
    methods.length > 0
      ? `- Methods: ${methods.join("; ")}`
      : "- Methods: None. Adds properties and filter conditions to the methods it extends.",
    capability.accountDetails.length > 0 &&
      `- Account details: ${fields(capability.accountDetails).join(", ")}`,
    capability.sessionDetails.length > 0 &&
      `- Session details: ${fields(capability.sessionDetails).join(", ")}`,
  ].filter(Boolean);

  return `### ${code(name)}\n\n${rows.join("\n")}`;
}

/** The capabilities whose names match `filter`, as Markdown sections */
export function capabilitiesMarkdown(
  builtIns: Record<string, BuiltInCapability>,
  filter: (name: string) => boolean,
): string {
  return Object.entries(builtIns)
    .filter(([name]) => filter(name))
    .map(([name, capability]) => capabilityMarkdown(name, capability))
    .join("\n\n");
}

/** A Markdown table of each entity and the capabilities that declare it */
export function entitiesMarkdown(builtIns: Record<string, BuiltInCapability>): string {
  const entities = new Set(Object.values(builtIns).flatMap((c) => c.entities));
  const rows = [...entities].toSorted().map((entity) => {
    const names = Object.entries(builtIns)
      .filter(([, { entities }]) => entities.includes(entity))
      .map(([name]) => code(name));
    return `| ${code(entity)} | ${names.join(", ")} |`;
  });
  return ["| Entity | Capabilities |", "| --- | --- |", ...rows].join("\n");
}

function cdnImportMarkdown(): string {
  const pkg = pkgData.load();
  const installPath = pkg.exports["."].replace("./", "");
  const cdnUrl = `https://unpkg.com/json-meta-client@${pkg.version}/${installPath}`;
  return [
    "```html [index.html]",
    '<script type="module">',
    `  import { JsonMetaClient } from "${cdnUrl}";`,
    "</script>",
    "```",
  ].join("\n");
}

/**
 * Fill in content that pages render with Vue, so the Markdown copies that
 * `vitepress-plugin-llms` publishes include it. A page marks the spot with an
 * `<!-- llms:<name> -->` comment; this replaces the comment with an
 * `<llm-only>` block, which the LLM plugin removes from the HTML page. List
 * this plugin before the LLM plugin.
 */
export function llmsContent(): Plugin {
  const generators: Record<string, () => string> = {
    "capabilities-built-in": () =>
      capabilitiesMarkdown(capabilitiesData.load(), (name) => !name.startsWith("community:")),
    "capabilities-community": () =>
      capabilitiesMarkdown(capabilitiesData.load(), (name) => name.startsWith("community:")),
    "capabilities-by-entity": () => entitiesMarkdown(capabilitiesData.load()),
    "cdn-import": cdnImportMarkdown,
  };

  return {
    name: "llms-content",
    enforce: "pre",
    transform(source, id) {
      if (!id.endsWith(".md") || !source.includes("<!-- llms:")) {
        return null;
      }
      return source.replaceAll(/<!-- llms:([\w-]+) -->/g, (_, name: string) => {
        const generate = generators[name];
        if (!generate) {
          throw new Error(`Unknown LLM content "${name}" in ${id}`);
        }
        return `<llm-only>\n\n${generate()}\n\n</llm-only>`;
      });
    },
  };
}
