# Refract

A minimal React-like virtual DOM library focused on image rendering. Refract
implements the core ideas behind React -- a virtual DOM, createElement, render,
reconciliation, hooks, context, and memo -- in TypeScript, with split
entrypoints so you can keep bundles small.

## LLM Disclosure
I generated this using Claude Opus 4.6 and gpt-5.3-codex as an experiment.

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

The values below are from a local run on February 14, 2026.

| Framework                  | JS bundle (raw) | JS bundle (gzip) |
|---------------------------|----------------:|-----------------:|
| Refract (`core`)          | 7.44 kB         | 2.91 kB          |
| Refract (`core+hooks`)    | 8.74 kB         | 3.36 kB          |
| Refract (`core+context`)  | 7.92 kB         | 3.14 kB          |
| Refract (`core+memo`)     | 8.07 kB         | 3.14 kB          |
| Refract (`core+security`) | 8.49 kB         | 3.27 kB          |
| Refract (`refract`)       | 13.55 kB        | 5.01 kB          |
| React                     | 189.74 kB       | 59.52 kB         |
| Preact                    | 14.46 kB        | 5.95 kB          |

Load-time metrics are machine-dependent, so the benchmark script prints a fresh
per-run timing table (median, p95, min/max, sd) for every framework.

From this snapshot, Refract `core` gzip JS is about 20.5x smaller than React,
and the full `refract` entrypoint is about 11.9x smaller.

### Component Combination Benchmarks (Vitest)

`benchmark/components.bench.ts` runs 16 component combinations (`memo`,
`context`, `fragment`, `keyed`) across two phases each (mount + reconcile).
Higher `hz` is better.

| Component usage profile | Mount (hz) | Mount vs base | Reconcile (hz) | Reconcile vs base |
|-------------------------|------------|---------------|----------------|-------------------|
| `base` | 5106.18 | baseline | 4318.36 | baseline |
| `memo` | 5859.77 | +14.8% | 3980.85 | -7.8% |
| `context` | 3555.39 | -30.4% | 5134.53 | +18.9% |
| `fragment` | 4894.97 | -4.1% | 4122.51 | -4.5% |
| `keyed` | 5856.46 | +14.7% | 4698.69 | +8.8% |
| `memo+context` | 6048.46 | +18.4% | 5218.68 | +20.8% |
| `memo+context+keyed` | 5640.31 | +10.5% | 4682.63 | +8.4% |

In this run, `memo+context` was the fastest mount profile, while
`memo+context` was also the fastest reconcile profile.

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
| Class components               | No      | Yes   | Yes    |
| **Hooks**                      |         |       |        |
| useState                       | Yes     | Yes   | Yes    |
| useEffect                      | Yes     | Yes   | Yes    |
| useLayoutEffect                | No      | Yes   | Yes    |
| useRef                         | Yes     | Yes   | Yes    |
| useMemo / useCallback          | Yes     | Yes   | Yes    |
| useReducer                     | Yes     | Yes   | Yes    |
| useContext                     | Yes     | Yes   | Yes    |
| useId                          | No      | Yes   | Yes    |
| useTransition / useDeferredValue | No    | Yes   | No     |
| **State & Data Flow**          |         |       |        |
| Built-in state management      | Yes     | Yes   | Yes    |
| Context API                    | Yes     | Yes   | Yes    |
| Refs (createRef / ref prop)    | Yes     | Yes   | Yes    |
| forwardRef                     | No      | Yes   | Yes    |
| **Rendering**                  |         |       |        |
| Event handling                 | Yes     | Yes   | Yes    |
| Style objects                  | Yes     | Yes   | Yes    |
| className prop                 | Yes     | Yes   | Yes¹   |
| dangerouslySetInnerHTML        | Yes     | Yes   | Yes    |
| Portals                        | No      | Yes   | Yes    |
| Suspense / lazy                | No      | Yes   | Yes²   |
| Error boundaries               | Yes³    | Yes   | Yes    |
| Server-side rendering          | No      | Yes   | Yes    |
| Hydration                      | No      | Yes   | Yes    |
| **Security**                   |         |       |        |
| Default HTML sanitizer for `dangerouslySetInnerHTML` | Yes | No | No |
| Configurable HTML sanitizer hook (`setHtmlSanitizer`) | Yes | No | No |
| **Performance**                |         |       |        |
| Fiber architecture             | Yes     | Yes   | No     |
| Concurrent rendering           | No      | Yes   | No     |
| Automatic batching             | Yes     | Yes   | Yes    |
| memo / PureComponent           | Yes     | Yes   | Yes    |
| **Ecosystem**                  |         |       |        |
| DevTools                       | Basic (hook API) | Yes   | Yes    |
| React compatibility layer      | N/A     | N/A   | Yes    |
| **Bundle Size (gzip, JS)**     | ~2.9-5.0 kB⁴ | ~59.5 kB | ~6.0 kB |

¹ Preact supports both `class` and `className`.
² Preact has partial Suspense support via `preact/compat`.
³ Refract uses the `useErrorBoundary` hook rather than class-based error boundaries.
⁴ Refract size depends on entrypoint (`refract/core` vs `refract` full).

## License

MIT
