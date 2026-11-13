# PROTOTYPE: source lines for method calls and pending awaits (#201)

Throwaway. Answers whether the playground worker can link each method call and
each pending `await` to its line of user code. Not production code; do not merge
to `main`. The findings are in the comment on #201.

## Run

```sh
pnpm exec tsdown -c prototypes/source-lines/tsdown.config.ts
node prototypes/source-lines/run.mjs <path-to-playwright> [chromium|firefox|webkit ...]
```

`<path-to-playwright>` is an installed `playwright` package (not a dependency of
this repository). Each case in `cases.mjs` runs in a fresh module Web Worker.

- `transform.ts`: TypeScript compiler API transformer.
- `runtime.ts`: the `__pg` object the instrumented code calls, and the report.
- `worker.ts`: runs the code against the real library with a fetch that never
  settles the JMAP POST.
