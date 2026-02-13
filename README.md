# Refract

A minimal React-like virtual DOM library focused on image rendering. Refract
implements the core ideas behind React -- a virtual DOM, createElement, render,
and reconciliation -- in under 200 lines of TypeScript, producing a JavaScript
bundle roughly 54x smaller than React.

## Features

- **createElement** -- builds virtual DOM nodes from tags, props, and children
- **render** -- mounts a VNode tree into a real DOM container
- **reconcile** -- diffs old and new VNode trees and patches the DOM in place
- **Functional components** -- plain functions that accept props and return VNodes
- **Scoped element types** -- supports `div`, `span`, and `img` tags

No JSX transform is required, but the library works with one. The tsconfig maps
`jsxFactory` to `createElement` so JSX can be used if desired.

## Project Structure

```
refract/
  src/refract/
    types.ts          -- VNode, Props, Component type definitions
    createElement.ts  -- VNode factory (handles components, children, text nodes)
    render.ts         -- initial mount + prop application
    reconcile.ts      -- diffing and minimal DOM patching
    index.ts          -- public API barrel export
  demo/               -- image gallery demo app
  tests/              -- Vitest unit tests
  benchmark/          -- Puppeteer-based benchmark vs React
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
   and numbers to text VNodes, filtering out nulls and booleans) and invokes
   functional components immediately.

2. `render` walks the VNode tree and creates real DOM nodes. Props are applied
   as attributes, with special handling for `className`, `style` objects, and
   `on*` event listeners. The current VNode tree is stored on the container
   element for later diffing.

3. `reconcile` compares old and new VNode trees node-by-node:
   - If the node type changed, the entire subtree is replaced.
   - If a text node changed, only `textContent` is updated.
   - Otherwise, props are diffed and children are reconciled recursively.
   - Extra old children are removed; extra new children are appended.

There is no keyed diffing, fiber architecture, or scheduling. This keeps the
implementation small and easy to follow.

## Benchmark

The benchmark compares Refract against React 19 rendering an identical image
gallery app (6 cards with images, captions, and a shuffle button). Both apps
are built with Vite and served as static production bundles. Measurements are
taken with Puppeteer over 15 runs per framework with the browser cache disabled
and external image requests blocked.

### Bundle Size

| Metric           | Refract   | React      | Ratio |
|------------------|-----------|------------|-------|
| JS bundle (raw)  | 3.49 kB   | 189.74 kB  | 54.4x |
| JS bundle (gzip) | 1.45 kB   | 59.52 kB   | 41.1x |
| All assets (raw) | 4.76 kB   | 191.01 kB  | 40.1x |

### Load Time (median of 15 runs)

| Metric           | Refract  | React    | Ratio |
|------------------|----------|----------|-------|
| DOM Interactive   | 7.00 ms  | 6.80 ms  | ~1.0x |
| DOMContentLoaded  | 10.80 ms | 19.90 ms | 1.8x  |
| App Render (rAF)  | <0.1 ms  | 0.10 ms  | ~1.0x |

Refract's production JS bundle is over 54x smaller than React's before
compression and 41x smaller after gzip. The DOMContentLoaded time -- which
reflects the cost of downloading, parsing, and executing JavaScript -- is
roughly 1.8x faster with Refract. Actual app render time (measured via
requestAnimationFrame after the framework populates the DOM) is negligible for
both frameworks at this scale.

### Running the Benchmark

Build both demo apps, then run the benchmark script:

```sh
# Build the Refract demo
yarn build

# Build the React demo
cd benchmark/react-demo && yarn install && yarn build && cd ../..

# Install benchmark dependencies and run
cd benchmark && yarn install && yarn bench
```

## License

MIT
