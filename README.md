# Refract

A minimal React-like virtual DOM library focused on image rendering. Refract
implements the core ideas behind React -- a virtual DOM, createElement, render,
reconciliation, hooks, context, and memo -- in TypeScript, producing a
JavaScript bundle roughly 21x smaller than React.

## LLM Disclosure
I generated this using Claude Opus 4.6 and gpt-5.3-codex as an experiment.

## Features

- **createElement / JSX** -- builds virtual DOM nodes from tags, props, and children
- **Fragments** -- group children without extra DOM nodes
- **render** -- mounts a VNode tree into a real DOM container
- **Fiber-based reconciliation** -- keyed and positional diffing with minimal DOM patches
- **Hooks** -- useState, useEffect, useRef, useMemo, useCallback, useReducer, useContext, useErrorBoundary
- **Context API** -- createContext / Provider for dependency injection
- **memo** -- skip re-renders when props are unchanged
- **Refs** -- createRef and callback refs via the `ref` prop
- **Error boundaries** -- catch and recover from render errors
- **SVG support** -- automatic SVG namespace handling
- **dangerouslySetInnerHTML** -- raw HTML injection with a default sanitizer and configurable `setHtmlSanitizer` override
- **Automatic batching** -- state updates are batched via microtask queue
- **DevTools hook support** -- emits commit/unmount snapshots to a global hook or explicit hook instance

No JSX transform is required, but the library works with one. The tsconfig maps
`jsxFactory` to `createElement` so JSX can be used if desired.

## Project Structure

```
refract/
  src/refract/
    types.ts          -- VNode, Fiber, Props, Hook type definitions
    createElement.ts  -- VNode factory + Fragment symbol
    fiber.ts          -- fiber-based renderer, commit, memo, effects
    devtools.ts       -- optional devtools bridge + snapshot serialization
    reconcile.ts      -- keyed + positional child diffing
    hooks.ts          -- useState, useEffect, useRef, useMemo, useCallback, useReducer, useErrorBoundary
    context.ts        -- createContext + useContext
    render.ts         -- public render() entry point
    index.ts          -- public API barrel export
  demo/               -- image gallery demo app
  tests/              -- Vitest unit tests
  benchmark/          -- Puppeteer-based benchmark vs React & Preact
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

## API

### createElement(type, props, ...children)

Creates a virtual DOM node. If `type` is a function, it is called as a
functional component.

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

### reconcile(parent, oldVNode, newVNode, index)

Low-level function that diffs two VNode trees and applies minimal DOM mutations.
Called automatically by `render` on re-renders.

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

The benchmark compares Refract against React 19 and Preact 10 rendering an
identical image gallery app (6 cards with images, captions, and a shuffle
button). All three apps are built with Vite and served as static production
bundles. Measurements are taken with Puppeteer (15 measured + 3 warmup runs per
framework by default) using round-robin ordering, browser cache disabled, and
external image requests blocked.
The results below are from a local run on February 13, 2026.

### Bundle Size

| Metric           | Refract   | React      | Preact    |
|------------------|-----------|------------|-----------|
| JS bundle (raw)  | 8.92 kB   | 189.74 kB  | 14.46 kB  |
| JS bundle (gzip) | 3.42 kB   | 59.52 kB   | 5.95 kB   |
| All assets (raw) | 10.19 kB  | 191.01 kB  | 15.74 kB  |

### Load Time (median of 15 runs)

| Metric           | Refract   | React     | Preact    |
|------------------|-----------|-----------|-----------|
| DOM Interactive   | 6.90 ms   | 6.60 ms   | 6.40 ms   |
| DOMContentLoaded  | 11.00 ms  | 18.40 ms  | 10.60 ms  |
| App Render (rAF)  | <0.1 ms   | <0.1 ms   | <0.1 ms   |

Refract's production JS bundle is ~21.3x smaller than React's and ~1.6x smaller
than Preact's before compression. After gzip, Refract is ~17.4x smaller than
React and ~1.7x smaller than Preact. Despite now including hooks, context, memo,
keyed reconciliation, fragments, error boundaries, a default HTML sanitizer, and
a fiber architecture, the bundle remains under 9 kB uncompressed. The DOMContentLoaded time --
which reflects the cost of downloading, parsing, and executing JavaScript -- is
roughly 1.7x faster with Refract compared to React and close to Preact in this
run (11.0 ms vs 10.6 ms). Actual app render time is negligible for all three
frameworks at this scale.

### Running the Benchmark

Recommended:

```sh
# Standard benchmark (default: 15 measured + 3 warmup)
make benchmark

# Stress benchmark (default: 50 measured + 5 warmup)
make bench-stress

# CI guardrails (fails if Refract DOMContentLoaded p95/sd exceed thresholds)
make bench-ci
```

Custom run counts and thresholds:

```sh
# Example: deeper stress run
make bench-stress STRESS_RUNS=100 STRESS_WARMUP=10

# Example: stricter CI thresholds
make bench-ci CI_RUNS=50 CI_WARMUP=5 CI_DCL_P95_MAX=15 CI_DCL_SD_MAX=1.5
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
| **Bundle Size (gzip)**         | ~3.4 kB | ~59.5 kB | ~6.0 kB |

¹ Preact supports both `class` and `className`.
² Preact has partial Suspense support via `preact/compat`.
³ Refract uses the `useErrorBoundary` hook rather than class-based error boundaries.

## License

MIT
