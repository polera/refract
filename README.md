# Refract

A minimal React-like virtual DOM library focused on image rendering. Refract
implements the core ideas behind React -- a virtual DOM, createElement, render,
and reconciliation -- in under 200 lines of TypeScript, producing a JavaScript
bundle roughly 54x smaller than React.

## LLM Disclosure
I generated this using Claude Opus 4.6 as an experiment.

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

The benchmark compares Refract against React 19 and Preact 10 rendering an
identical image gallery app (6 cards with images, captions, and a shuffle
button). All three apps are built with Vite and served as static production
bundles. Measurements are taken with Puppeteer over 15 runs per framework with
the browser cache disabled and external image requests blocked.

### Bundle Size

| Metric           | Refract   | React      | Preact    |
|------------------|-----------|------------|-----------|
| JS bundle (raw)  | 3.49 kB   | 189.74 kB  | 14.46 kB  |
| JS bundle (gzip) | 1.45 kB   | 59.52 kB   | 5.95 kB   |
| All assets (raw) | 4.76 kB   | 191.01 kB  | 15.74 kB  |

### Load Time (median of 15 runs)

| Metric           | Refract  | React    | Preact   |
|------------------|----------|----------|----------|
| DOM Interactive   | 6.90 ms  | 6.80 ms  | 6.70 ms  |
| DOMContentLoaded  | 10.90 ms | 18.60 ms | 10.80 ms |
| App Render (rAF)  | 0.10 ms  | 0.10 ms  | <0.1 ms  |

Refract's production JS bundle is over 54x smaller than React's and 4x smaller
than Preact's before compression. After gzip, Refract is 41x smaller than React
and 4x smaller than Preact. The DOMContentLoaded time -- which reflects the
cost of downloading, parsing, and executing JavaScript -- is roughly 1.7x
faster with Refract compared to React and on par with Preact. Actual app render
time (measured via requestAnimationFrame after the framework populates the DOM)
is negligible for all three frameworks at this scale.

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
| Keyed reconciliation           | No      | Yes   | Yes    |
| Fragments                      | No      | Yes   | Yes    |
| JSX support                    | Yes     | Yes   | Yes    |
| **Components**                 |         |       |        |
| Functional components          | Yes     | Yes   | Yes    |
| Class components               | No      | Yes   | Yes    |
| **Hooks**                      |         |       |        |
| useState                       | No      | Yes   | Yes    |
| useEffect / useLayoutEffect    | No      | Yes   | Yes    |
| useRef                         | No      | Yes   | Yes    |
| useMemo / useCallback          | No      | Yes   | Yes    |
| useReducer                     | No      | Yes   | Yes    |
| useContext                      | No      | Yes   | Yes    |
| useId                          | No      | Yes   | Yes    |
| useTransition / useDeferredValue | No    | Yes   | No     |
| **State & Data Flow**          |         |       |        |
| Built-in state management      | No      | Yes   | Yes    |
| Context API                    | No      | Yes   | Yes    |
| Refs (createRef / forwardRef)  | No      | Yes   | Yes    |
| **Rendering**                  |         |       |        |
| Event handling                 | Yes     | Yes   | Yes    |
| Style objects                  | Yes     | Yes   | Yes    |
| className prop                 | Yes     | Yes   | Yes¹   |
| Portals                        | No      | Yes   | Yes    |
| Suspense / lazy                | No      | Yes   | Yes²   |
| Error boundaries               | No      | Yes   | Yes    |
| Server-side rendering          | No      | Yes   | Yes    |
| Hydration                      | No      | Yes   | Yes    |
| **Performance**                |         |       |        |
| Fiber architecture             | No      | Yes   | No     |
| Concurrent rendering           | No      | Yes   | No     |
| Automatic batching             | No      | Yes   | Yes    |
| memo / PureComponent           | No      | Yes   | Yes    |
| **Ecosystem**                  |         |       |        |
| DevTools                       | No      | Yes   | Yes    |
| React compatibility layer      | N/A     | N/A   | Yes    |
| **Bundle Size (gzip)**         | ~1.5 kB | ~60 kB | ~6 kB |

¹ Preact supports both `class` and `className`.
² Preact has partial Suspense support via `preact/compat`.

## License

MIT
