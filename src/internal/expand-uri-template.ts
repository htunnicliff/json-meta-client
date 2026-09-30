import { JmapConfigurationError, JmapProtocolError } from "../error.ts";

/**
 * Expand an rfc 6570 URI template into a regular URI
 */
export function expandURITemplate(template: string, params: Record<string, string>): string {
  let uri = template;
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== "string")
      throw new JmapConfigurationError(`Missing URI parameter "${key}"`);
    const target = `{${key}}`;
    if (!uri.includes(target)) {
      throw new JmapProtocolError(`Template does not contain "${target}"`, { payload: template });
    }
    uri = uri.replace(target, encodeURIComponent(value));
  }
  if (!URL.canParse(uri))
    throw new JmapProtocolError("Invalid URI template", { payload: template });
  return uri;
}
