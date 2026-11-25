/**
 * Turn the arguments of a `console` call into readable text, roughly as
 * browser consoles and Node do: strings as they are, other values as
 * JavaScript-like literals, wrapped onto several lines when long.
 */
export function formatConsoleArgs(args: readonly unknown[]): string {
  return args.map((arg) => (typeof arg === "string" ? arg : formatValue(arg))).join(" ");
}

const MAX_DEPTH = 4;
const MAX_LINE = 72;
const MAX_ITEMS = 100;
const identifier = /^[A-Za-z_$][\w$]*$/;

/**
 * A readable, JavaScript-like form of any value
 */
export function formatValue(value: unknown): string {
  return format(value, 0, new Set());
}

function format(value: unknown, depth: number, seen: Set<object>): string {
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "bigint":
      return `${value}n`;
    case "symbol":
      return value.toString();
    case "function":
      return `[Function ${value.name || "(anonymous)"}]`;
    case "undefined":
      return "undefined";
    case "number":
    case "boolean":
      return String(value);
  }
  if (value === null || typeof value !== "object") {
    return String(value);
  }
  const object = value;
  if (object instanceof Error) {
    return `${object.name}: ${object.message}`;
  }
  if (object instanceof Date) {
    return Number.isNaN(object.getTime()) ? "Invalid Date" : object.toISOString();
  }
  if (object instanceof RegExp) {
    return String(object);
  }
  if (seen.has(object)) {
    return "[Circular]";
  }
  const name = constructorName(object);
  if (depth >= MAX_DEPTH) {
    return `[${name}]`;
  }
  seen.add(object);
  try {
    const nested = (item: unknown) => format(item, depth + 1, seen);
    if (Array.isArray(object)) {
      return wrap("[", "]", limit(object.map(nested)), depth, "");
    }
    if (object instanceof Map) {
      const entries = [...object].map(([key, item]) => `${nested(key)} => ${nested(item)}`);
      return wrap("{", "}", limit(entries), depth, `Map(${object.size}) `);
    }
    if (object instanceof Set) {
      return wrap("{", "}", limit([...object].map(nested)), depth, `Set(${object.size}) `);
    }
    const entries = Object.entries(object).map(
      ([key, item]) => `${identifier.test(key) ? key : JSON.stringify(key)}: ${nested(item)}`,
    );
    return wrap("{", "}", limit(entries), depth, name === "Object" ? "" : `${name} `);
  } finally {
    seen.delete(object);
  }
}

function constructorName(object: object): string {
  const prototype: unknown = Object.getPrototypeOf(object);
  const constructor: unknown =
    prototype && typeof prototype === "object" ? Reflect.get(prototype, "constructor") : undefined;
  const name: unknown = typeof constructor === "function" ? constructor.name : undefined;
  return typeof name === "string" && name ? name : "Object";
}

function limit(items: string[]): string[] {
  if (items.length <= MAX_ITEMS) {
    return items;
  }
  return [...items.slice(0, MAX_ITEMS), `... ${items.length - MAX_ITEMS} more`];
}

/**
 * Items on one line when they fit, otherwise one per line
 */
function wrap(open: string, close: string, items: string[], depth: number, prefix: string): string {
  if (!items.length) {
    return `${prefix}${open}${close}`;
  }
  const line = `${prefix}${open} ${items.join(", ")} ${close}`;
  const fits = line.length + depth * 2 <= MAX_LINE && !line.includes("\n");
  if (fits) {
    return open === "[" ? `${prefix}[${items.join(", ")}]` : line;
  }
  const indent = "  ".repeat(depth + 1);
  const body = items.map((item) => `${indent}${item}`).join(",\n");
  return `${prefix}${open}\n${body},\n${"  ".repeat(depth)}${close}`;
}
