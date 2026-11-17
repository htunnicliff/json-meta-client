// Modules that Vite provides to the playground

declare module "*?raw" {
  const text: string;
  export default text;
}

declare module "*?worker" {
  const WorkerConstructor: new () => Worker;
  export default WorkerConstructor;
}

declare module "virtual:playground-libs" {
  /** TypeScript's lib files by file name; see `types-plugin.ts` */
  const files: Record<string, string>;
  export default files;
}

declare module "virtual:playground-types" {
  /** Declaration files by path; see `types-plugin.ts` */
  const files: Record<string, string>;
  export default files;
}
