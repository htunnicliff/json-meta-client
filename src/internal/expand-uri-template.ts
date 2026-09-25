/**
 * Expand an rfc 6570 URI template into a regular URI
 */
export function expandURITemplate(template: string, params: Record<string, string>): string {
  let uri = template;
  for (const [key, value] of Object.entries(params)) {
    const target = `{${key}}`;
    if (!uri.includes(target)) {
      throw new Error(`Template does not contain "${target}"`);
    }
    uri = uri.replace(target, encodeURIComponent(value));
  }
  return uri;
}
