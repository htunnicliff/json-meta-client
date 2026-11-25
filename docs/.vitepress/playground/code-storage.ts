import { defaultExample, examples, findExample } from "./examples.ts";

const STORAGE_KEY = "json-meta-client:playground:source";

/**
 * What this browser keeps of the code: an example by its ID, so the playground
 * shows the example's current code, or the user's own code as written
 */
type StoredCode = { example: string } | { code: string };

function isStoredCode(value: unknown): value is StoredCode {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if ("example" in value) {
    return typeof value.example === "string";
  }
  return "code" in value && typeof value.code === "string";
}

/**
 * The code last in the playground in this browser, or the first example
 */
export function loadCode(): string {
  const fallback = defaultExample;
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (!isStoredCode(stored)) {
      return fallback;
    }
    if ("code" in stored) {
      return stored.code;
    }
    return examples.find((example) => example.id === stored.example)?.code ?? fallback;
  } catch {
    // Storage can be unavailable, or hold something else; the first example stands
    return fallback;
  }
}

/**
 * Keep the code in this browser, so it outlasts a reload
 */
export function saveCode(code: string): void {
  const example = findExample(code);
  const stored: StoredCode = example ? { example: example.id } : { code };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable, as in a private window; the code lasts the visit
  }
}
