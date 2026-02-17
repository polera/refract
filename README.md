![](assets/lens-syntax-refract.svg "=x200")

# Refract

A minimal React-like virtual DOM library, written in TypeScript with split entrypoints
so you can keep bundles small and targeted.

Refract implements the core ideas behind React in TypeScript
- a virtual DOM
- createElement
- render
- reconciliation
- hooks
- context
- memo

## LLM Disclosure
This project is an experiment and uses code generated with both Claude Opus 4.6 and gpt-5.3-codex.

## Features

- **createElement / JSX** -- builds virtual DOM nodes from tags, props, and children
- **Fragments** -- group children without extra DOM nodes
- **render** -- mounts a VNode tree into a real DOM container
- **Fiber-based reconciliation** -- keyed and positional diffing with minimal DOM patches
- **Hooks** -- useState, useEffect, useRef, useMemo, useCallback, useReducer, useErrorBoundary
- **Context API** -- createContext / Provider for dependency injection
- **memo** -- skip re-renders when props are unchanged
- **Refs** -- createRef and callback refs via the `ref` prop
- **Error boundaries** -- catch and recover from render errors
- **SVG support** -- automatic SVG namespace handling
- **dangerouslySetInnerHTML** -- raw HTML injection with sanitizer defaults in `refract/full` and configurable `setHtmlSanitizer` override
- **Automatic batching** -- state updates are batched via microtask queue
- **DevTools hook support** -- emits commit/unmount snapshots to a global hook or explicit hook instance

No JSX transform is required, but the library works with one. The tsconfig maps
`jsxFactory` to `createElement` so JSX can be used if desired.

## Project Structure

```
refract/
  src/refract/
    createElement.ts      -- VNode factory + Fragment symbol
    coreRenderer.ts       -- render work loop + commit + batched updates
    reconcile.ts          -- keyed + positional child diffing
    dom.ts                -- DOM creation/prop patching + sanitizer hooks
    renderCore.ts         -- minimal render() entrypoint used by `refract/core`
    render.ts             -- full render() entrypoint (auto-enables security defaults)
    hooksRuntime.ts       -- effect scheduling + cleanup lifecycle wiring
    runtimeExtensions.ts  -- runtime plugin hooks (memo/devtools/effects/errors)
    devtools.ts           -- optional devtools bridge + snapshot serialization
    full.ts               -- full public API exports
    core.ts               -- minimal public API exports
    features/             -- feature modules (`hooks`, `context`, `memoRuntime`, `security`)
  demo/                   -- image gallery demo app
  tests/                  -- Vitest unit tests
  benchmark/              -- Puppeteer benchmark: Refract entrypoint matrix vs React & Preact
```

## Getting Started

```sh
yarn install
```

Run the demo dev server:

```sh
yarn dev
```

Run the tests:

```sh
yarn test
```

## Entrypoints

- `refract/core` -- minimal runtime surface (`createElement`, `Fragment`, `render`) with no default HTML sanitizer
- `refract/full` -- complete API including hooks, context, memo, sanitizer defaults, and devtools integration
- `refract` -- alias of `refract/full` for backward compatibility
- Feature entrypoints for custom bundles: `refract/hooks`, `refract/context`, `refract/memo`, `refract/security`, `refract/devtools`
- Optional React-compat entrypoints (opt-in): `refract/compat/react`, `refract/compat/react-dom`, `refract/compat/react-dom/client`, `refract/compat/react/jsx-runtime`, `refract/compat/react/jsx-dev-runtime`

### React Ecosystem Compatibility (Opt-in)

Refract now includes an opt-in compatibility layer so you can alias React imports
for selected ecosystem libraries (for example MUI, `react-router-dom`, and
`@dnd-kit`) without inflating the default `refract/core` path.

Supported compat APIs include:
- `forwardRef`, `cloneElement`, `Children`, `isValidElement`
- `useLayoutEffect`, `useInsertionEffect`, `useId`
- `useSyncExternalStore`, `useImperativeHandle`
- `createPortal`
- `createRoot`, `flushSync`, `unstable_batchedUpdates`
- `jsx/jsxs/jsxDEV` runtime entrypoints
- React hook dispatcher bridge internals (`__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE`) with optional `registerExternalReactModule(...)` for mixed-runtime environments (tests/Node)

Example Vite aliases:

```ts
// vite.config.ts
import { defineConfig } from "vite";

export default defineConfig({
  resolve: {
    alias: {
      react: "refract/compat/react",
      "react-dom": "refract/compat/react-dom",
      "react-dom/client": "refract/compat/react-dom/client",
      "react/jsx-runtime": "refract/compat/react/jsx-runtime",
      "react/jsx-dev-runtime": "refract/compat/react/jsx-dev-runtime",
    },
  },
});
```

The compat layer is intentionally separate from core so users who do not need
React ecosystem compatibility keep the smallest and fastest Refract bundles.

Compatibility status (last verified February 17, 2026):
- `yarn test`: 14 files passed, 85 tests passed
- Compat-focused suites passed: `tests/compat.test.ts` (10), `tests/poc-compat.test.ts` (2), `tests/react-router-smoke.test.ts` (3)
- Verified behaviors include `forwardRef`, portals, `createRoot`, JSX runtimes, `useSyncExternalStore`, `flushSync`, and react-router tree construction/dispatcher bridging

## API

### createElement(type, props, ...children)

Creates a virtual DOM node. If `type` is a function, it is treated as a
functional component and invoked during render/reconciliation.

```ts
import { createElement } from "refract";

const vnode = createElement("div", { className: "card" },
  createElement("img", { src: "photo.jpg", alt: "A photo" }),
  createElement("span", null, "Caption text"),
);
```

### render(vnode, container)

Mounts a VNode tree into a DOM element. On subsequent calls with the same
container, it reconciles against the previous tree instead of re-mounting.

```ts
import { render } from "refract";

render(vnode, document.getElementById("app")!);
```

Reconciliation is internal and is triggered automatically by `render` on
subsequent renders to the same container.

### DevTools hook integration

Refract emits commit and unmount events when a hook is present at
`window.__REFRACT_DEVTOOLS_GLOBAL_HOOK__` (or `globalThis` in non-browser
environments). You can also set the hook directly with `setDevtoolsHook`.

```ts
import { setDevtoolsHook } from "refract";

setDevtoolsHook({
  inject(renderer) {
    console.log(renderer.name); // "refract"
    return 1;
  },
  onCommitFiberRoot(rendererId, root) {
    console.log(rendererId, root.current?.type);
  },
  onCommitFiberUnmount(rendererId, fiber) {
    console.log(rendererId, fiber.type);
  },
});
```

## How It Works

1. `createElement` normalizes children (flattening arrays, converting strings
   and numbers to text VNodes, filtering out nulls and booleans). Component
   functions are stored as VNode types and called later during reconciliation.

2. `render` builds a fiber tree from the VNode tree. Each fiber holds a
   reference to its DOM node, hooks, and alternate (previous render). Props are
   applied as attributes, with special handling for `className`, `style`
   objects, `ref`, and `on*` event listeners.

3. Reconciliation diffs old and new children using keyed matching (when keys
   are present) or positional matching. Fibers are flagged for placement,
   update, or deletion. After the work phase, a commit phase applies all DOM
   mutations in a single pass, followed by an effects phase that runs
   useEffect callbacks.

4. State updates from hooks are batched via `queueMicrotask` -- multiple
   `setState` calls within the same synchronous block result in a single
   re-render.

## Benchmark

The benchmark compares Refract entrypoint combinations against React 19 and
Preact 10, all rendering the same image gallery app (6 cards + shuffle).
Refract variants benchmarked:

- `refract/core`
- `refract/core` + `refract/hooks`
- `refract/core` + `refract/context`
- `refract/core` + `refract/memo`
- `refract/core` + `refract/security`
- `refract` (full entrypoint)

All benchmark apps are built with Vite and served as static production bundles.
Measurements are taken with Puppeteer (15 measured + 3 warmup runs per
framework by default), with round-robin ordering, cache disabled, and external
image requests blocked.

### Bundle Size Snapshot

The values below are from a local run on February 17, 2026.

| Framework                  | JS bundle (raw) | JS bundle (gzip) |
|---------------------------|----------------:|-----------------:|
| Refract (`core`)          | 10.02 kB        | 3.74 kB          |
| Refract (`core+hooks`)    | 12.08 kB        | 4.49 kB          |
| Refract (`core+context`)  | 10.66 kB        | 4.00 kB          |
| Refract (`core+memo`)     | 10.70 kB        | 3.97 kB          |
| Refract (`core+security`) | 10.93 kB        | 4.03 kB          |
| Refract (`refract`)       | 17.15 kB        | 6.23 kB          |
| React                     | 189.74 kB       | 59.52 kB         |
| Preact                    | 14.46 kB        | 5.95 kB          |

Load-time metrics are machine-dependent, so the benchmark script prints a fresh
per-run timing table (median, p95, min/max, sd) for every framework.
The CI preset (`make bench-ci`, 40 measured + 5 warmup runs) enforces default
guardrails (`DCL p95 <= 16ms`, `DCL sd <= 2ms`).

From this snapshot, Refract `core` gzip JS is about 15.9x smaller than React,
and the full `refract` entrypoint is about 9.6x smaller.

### Component Combination Benchmarks (Vitest)

`benchmark/components.bench.ts` runs 16 component combinations (`memo`,
`context`, `fragment`, `keyed`) across two phases each (mount + reconcile).
Higher `hz` is better.

| Component usage profile | Mount (hz) | Mount vs base | Reconcile (hz) | Reconcile vs base |
|-------------------------|------------|---------------|----------------|-------------------|
| `base` | 5160.53 | baseline | 3262.99 | baseline |
| `memo` | 4858.51 | -5.9% | 5092.55 | +56.1% |
| `context` | 3862.01 | -25.2% | 4954.24 | +51.8% |
| `fragment` | 4656.36 | -9.8% | 3760.97 | +15.3% |
| `keyed` | 5754.75 | +11.5% | 4311.45 | +32.1% |
| `memo+context` | 5872.59 | +13.8% | 4621.45 | +41.6% |
| `memo+context+keyed` | 5555.42 | +7.7% | 4509.78 | +38.2% |

In this run, `memo+context` was the fastest mount profile, while
`memo` was the fastest reconcile profile.

### Running the Benchmark

Recommended:

```sh
# Standard benchmark (default: 15 measured + 3 warmup)
make benchmark

# Stress benchmark (default: 50 measured + 5 warmup)
make bench-stress

# CI benchmark preset (CI-oriented run counts + benchmark flags)
make bench-ci

# Component-combination microbenchmarks (32 cases)
yarn bench:components
```

Custom run counts:

```sh
# Example: deeper stress run
make bench-stress STRESS_RUNS=100 STRESS_WARMUP=10

# Example: deeper CI run
make bench-ci CI_RUNS=50 CI_WARMUP=5
```

## Feature Matrix

How Refract compares to React and Preact:

| Feature                        | Refract | React | Preact |
|--------------------------------|---------|-------|--------|
| **Core**                       |         |       |        |
| Virtual DOM                    | Yes     | Yes   | Yes    |
| createElement                  | Yes     | Yes   | Yes    |
| Reconciliation / diffing       | Yes     | Yes   | Yes    |
| Keyed reconciliation           | Yes     | Yes   | Yes    |
| Fragments                      | Yes     | Yes   | Yes    |
| JSX support                    | Yes     | Yes   | Yes    |
| SVG support                    | Yes     | Yes   | Yes    |
| **Components**                 |         |       |        |
| Functional components          | Yes     | Yes   | Yes    |
| Class components               | Partial⁶ | Yes   | Yes    |
| **Hooks**                      |         |       |        |
| useState                       | Yes     | Yes   | Yes    |
| useEffect                      | Yes     | Yes   | Yes    |
| useLayoutEffect                | Yes     | Yes   | Yes    |
| useInsertionEffect             | Yes     | Yes   | Yes    |
| useRef                         | Yes     | Yes   | Yes    |
| useMemo / useCallback          | Yes     | Yes   | Yes    |
| useReducer                     | Yes     | Yes   | Yes    |
| useContext                     | Yes     | Yes   | Yes    |
| useId                          | Yes     | Yes   | Yes    |
| useSyncExternalStore           | Yes     | Yes   | Yes    |
| useImperativeHandle            | Yes     | Yes   | Yes    |
| useTransition / useDeferredValue | Partial⁵ | Yes | Partial⁷ |
| **State & Data Flow**          |         |       |        |
| Built-in state management      | Yes     | Yes   | Yes    |
| Context API                    | Yes     | Yes   | Yes    |
| Refs (createRef / ref prop)    | Yes     | Yes   | Yes    |
| forwardRef                     | Yes⁶    | Yes   | Yes    |
| **Rendering**                  |         |       |        |
| Event handling                 | Yes     | Yes   | Yes    |
| Style objects                  | Yes     | Yes   | Yes    |
| className prop                 | Yes     | Yes   | Yes¹   |
| dangerouslySetInnerHTML        | Yes     | Yes   | Yes    |
| Portals                        | Yes     | Yes   | Yes    |
| Suspense / lazy                | No⁸     | Yes   | Yes²   |
| Error boundaries               | Yes³    | Yes   | Yes    |
| Server-side rendering          | No      | Yes   | Yes    |
| Hydration                      | No⁹     | Yes   | Yes    |
| **Security**                   |         |       |        |
| Default HTML sanitizer for `dangerouslySetInnerHTML` | Yes | No | No |
| Configurable HTML sanitizer hook (`setHtmlSanitizer`) | Yes | No | No |
| **Performance**                |         |       |        |
| Fiber architecture             | Yes     | Yes   | No     |
| Concurrent rendering           | No      | Yes   | No     |
| Automatic batching             | Yes     | Yes   | Yes    |
| memo / PureComponent           | Partial¹⁰ | Yes | Yes    |
| **Ecosystem**                  |         |       |        |
| DevTools                       | Basic (hook API) | Yes   | Yes    |
| React compatibility layer      | Partial⁶ | N/A  | Yes⁷   |
| **Bundle Size (gzip, JS)**     | ~3.7-6.3 kB⁴ | ~59.5 kB | ~6.0 kB |

¹ Preact supports both `class` and `className`.
² Preact has partial Suspense support via `preact/compat`.
³ Refract core uses the `useErrorBoundary` hook; compat wrappers can emulate class-style boundaries.
⁴ Refract size depends on entrypoint (`refract/core` vs `refract` full).
⁵ Refract exposes `useTransition` / `useDeferredValue` but currently runs both synchronously (no concurrent scheduling).
⁶ Available via opt-in compat entrypoints (`refract/compat/react*`) with partial React API parity.
⁷ Preact compatibility is provided through `preact/compat`.
⁸ Compat exports `Suspense`/`lazy`, but full suspension/fallback semantics are not implemented.
⁹ `hydrateRoot` is exposed in compat, but currently performs client render rather than true SSR hydration.
¹⁰ `memo` is supported; `PureComponent` is compat-oriented and does not guarantee full React shallow-compare behavior.

## License

MIT
