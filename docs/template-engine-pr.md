# Upstream PR draft: `accordproject/template-engine`

**Branch:** `feat/typescript-runtime-bundle`
**Local path:** `~/dev/gh/accordproject/template-engine`
**Commit:** `0c3ff85` (DCO sign-off included)
**Status:** unpushed; verified end-to-end via the Phase 2 demo

## Title
feat(runtime): bundle multi-file TS template logic via esbuild

## Summary
- `TemplateArchiveProcessor.trigger` / `init` now delegate TypeScript compilation to a new `TemplateLogicBundler` that uses **esbuild with a virtual filesystem** over the template's script manager.
- Multi-file TS templates (e.g. `logic/logic.ts` + concerto-codegen output under `logic/generated/`) now execute through the runtime as designed. Previously only single-file templates worked because each `.ts` was compiled in isolation and only `logic/logic.ts` was evaluated — any relative import (`./generated/foo.js`) failed at runtime inside the `data:` URL ESM module.
- The Accord Project Smart Legal Contract runtime declarations (`TemplateLogic`, `IState`, `IRequest`, etc., decoded from `SMART_LEGAL_CONTRACT_BASE64`) are concatenated with the entry source so symbols resolve as module-local — preserving the existing `// @ts-ignore extends TemplateLogic<…>` convention used by the `latedeliveryandpenalty` reference template.
- Net change: `+345 / -181` lines across `package.json`, `package-lock.json`, `src/TemplateArchiveProcessor.ts`, and a new `src/TemplateLogicBundler.ts`.

## Why
The `accordproject.runtime: "typescript"` contract is the de-facto AP convention for new templates (and the strategic direction now that Ergo is being de-emphasised). Real templates ship multiple `.ts` files: hand-written logic plus typed concerto-codegen output. The prior implementation could only evaluate a single TS file as ESM, which forced template authors to either (a) restrict themselves to one file with no value-level imports, or (b) accept that the production runtime would fail even though their unit tests passed (since vitest does its own bundling). This change makes the documented contract actually work.

## Implementation details
- New `TemplateLogicBundler` exposes `bundle(entryPoint?)`.
- The plugin handles two cases:
  - Stdin entry whose `resolveDir` is `/<entryDir>` (e.g. `/logic`).
  - Subsequent in-namespace imports anchored at `dirname(importer)`.
- `resolveAgainstSources` probes `<key>`, `<key.js→ts>`, `<key>.ts`, `<key>/index.ts` so both NodeNext-style `./foo.js` imports and bare `./foo` imports resolve against the on-disk `.ts` sources.
- Anything under a `dist/` path segment is excluded, so a template that accidentally ships compiled output doesn't confuse the bundler.
- `esbuild` was already a `devDependency` (used by `rollup-plugin-esbuild`); promoted to `dependencies` since the bundler runs at trigger-time.

## What's not in this PR (intentionally)
- **Type-checking.** esbuild transpiles but does not type-check. The previous twoslash path didn't strictly type-check either (its `noErrorValidation: true` flag suppressed errors). Template authors should run `tsc --noEmit` against their `logic/*.ts` as a pre-publish step; the supplied `latedeliveryandpenalty` setup already does this. A follow-up could re-introduce type checking by running `ts.createProgram` against the bundled output before evaluation.
- **Removing `TypeScriptToJavaScriptCompiler` / `@typescript/twoslash`.** Still used by `TemplateMarkToJavaScriptCompiler`. Removal would be a separate, larger refactor.
- **Browser support.** esbuild ships native binaries; the bundler will work in Node and in environments that polyfill node:fs/process (esbuild-wasm). The TemplateArchiveProcessor was already Node-leaning (it uses `Buffer.from`), so this PR doesn't regress that.

## Test plan
- [ ] Existing jest suite (`npm test` from `template-engine`) passes.
- [x] Multi-file TS template (Concerto-generated types + hand-written `logic.ts`) executes end-to-end through `new TemplateArchiveProcessor(tpl).trigger(...)` and returns `{ result, state, events }`.
- [x] All three demo scenarios (APPROVED / REQUIRES_HUMAN_APPROVAL / DENIED) produce the expected decisions when invoked via the demo CLI through the patched runtime.

## Verification harness
The Phase 2 prototype at `~/dev/gh/accordproject/phase2-demo` exercises the patched template-engine end-to-end:

```bash
cd ~/dev/gh/accordproject/phase2-demo
npm install && npm run build && npm run demo
```

Three procurement scenarios run through the patched `TemplateArchiveProcessor.trigger()` against a multi-file TS template (`templates/agent-saas-authority/`) with concerto-codegen generated types under `logic/generated/`. Exit 0; both `obligationsHash` and Cicero `templateHash` round-trip through stub AP2 mandates.
