# Refract

A minimal React-like virtual DOM library focused on image rendering. Refract
implements the core ideas behind React -- a virtual DOM, createElement, render,
reconciliation, hooks, context, and memo -- in TypeScript, producing a
JavaScript bundle roughly 24x smaller than React.

## LLM Disclosure
I generated this using Claude Opus 4.6 as an experiment.

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
- **dangerouslySetInnerHTML** -- raw HTML injection
- **Automatic batching** -- state updates are batched via microtask queue

No JSX transform is required, but the library works with one. The tsconfig maps
`jsxFactory` to `createElement` so JSX can be used if desired.

## Project Structure

```
refract/
  src/refract/
    types.ts          -- VNode, Fiber, Props, Hook type definitions
    createElement.ts  -- VNode factory + Fragment symbol
    fiber.ts          -- fiber-based renderer, commit, memo, effects
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
bundles. Measurements are taken with Puppeteer over 15 runs per framework with
the browser cache disabled and external image requests blocked.

### Bundle Size

| Metric           | Refract   | React      | Preact    |
|------------------|-----------|------------|-----------|
| JS bundle (raw)  | 7.77 kB   | 189.74 kB  | 14.46 kB  |
| JS bundle (gzip) | 3.01 kB   | 59.52 kB   | 5.95 kB   |
| All assets (raw) | 9.04 kB   | 191.01 kB  | 15.74 kB  |

### Load Time (median of 15 runs)

| Metric           | Refract   | React     | Preact    |
|------------------|-----------|-----------|-----------|
| DOM Interactive   | 6.90 ms   | 6.90 ms   | 6.90 ms   |
| DOMContentLoaded  | 11.90 ms  | 19.70 ms  | 12.10 ms  |
| App Render (rAF)  | <0.1 ms   | <0.1 ms   | <0.1 ms   |

Refract's production JS bundle is ~24x smaller than React's and ~1.9x smaller
than Preact's before compression. After gzip, Refract is ~20x smaller than
React and ~2x smaller than Preact. Despite now including hooks, context, memo,
keyed reconciliation, fragments, error boundaries, and a fiber architecture,
the bundle remains well under 8 kB uncompressed. The DOMContentLoaded time --
which reflects the cost of downloading, parsing, and executing JavaScript -- is
roughly 1.7x faster with Refract compared to React and on par with Preact.
Actual app render time is negligible for all three frameworks at this scale.

### Running the Benchmark

Build all three demo apps, then run the benchmark script:

```sh
# Build the Refract demo
yarn build

# Build the React demo
cd benchmark/react-demo && yarn install && yarn build && cd ../..

# Build the Preact demo
cd benchmark/preact-demo && yarn install && yarn build && cd ../..

# Install benchmark dependencies and run
cd benchmark && yarn install && yarn bench
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
| **Performance**                |         |       |        |
| Fiber architecture             | Yes     | Yes   | No     |
| Concurrent rendering           | No      | Yes   | No     |
| Automatic batching             | Yes     | Yes   | Yes    |
| memo / PureComponent           | Yes     | Yes   | Yes    |
| **Ecosystem**                  |         |       |        |
| DevTools                       | No      | Yes   | Yes    |
| React compatibility layer      | N/A     | N/A   | Yes    |
| **Bundle Size (gzip)**         | ~3 kB   | ~60 kB | ~6 kB |

¹ Preact supports both `class` and `className`.
² Preact has partial Suspense support via `preact/compat`.
³ Refract uses the `useErrorBoundary` hook rather than class-based error boundaries.

## License

MIT
