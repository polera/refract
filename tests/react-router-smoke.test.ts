import { createRequire } from "node:module";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
  Link,
  MemoryRouter,
  Route,
  Routes,
} from "react-router-dom";
import { registerExternalReactModule } from "../src/refract/compat/react.js";

const require = createRequire(import.meta.url);
const externalReact = require("react") as typeof React;
registerExternalReactModule(externalReact);

describe("react-router-dom compatibility smoke", () => {
  it("resolves react aliases to refract compat entrypoints", () => {
    expect(typeof React.createElement).toBe("function");
    expect(typeof React.forwardRef).toBe("function");
    expect(typeof createRoot).toBe("function");
  });

  it("constructs a router tree with compat createElement", () => {
    const tree = React.createElement(
      MemoryRouter,
      { initialEntries: ["/"] },
      React.createElement(
        "div",
        null,
        React.createElement(Link, { to: "/about", id: "about-link" }, "About"),
        React.createElement(
          Routes,
          null,
          React.createElement(Route, { path: "/", element: React.createElement("h1", null, "Home") }),
          React.createElement(Route, { path: "/about", element: React.createElement("h1", null, "About") }),
        ),
      ),
    );
    expect(tree.type).toBe(MemoryRouter);
    expect(React.Children.count(tree.props.children)).toBe(1);
  });

  it("supports hook dispatcher bridging for externally-resolved React", async () => {
    const container = document.createElement("div");
    const root = createRoot(container);
    let setCount!: (value: number) => void;

    function Counter() {
      const [count, set] = externalReact.useState(0);
      setCount = set;
      return React.createElement("span", { id: "count" }, String(count));
    }

    function App() {
      return React.createElement(
        "div",
        null,
        React.createElement(Counter, null),
      );
    }

    root.render(React.createElement(App, null));
    expect(container.querySelector("#count")?.textContent).toBe("0");

    setCount(1);

    await new Promise<void>((resolve) => queueMicrotask(() => resolve()));

    expect(container.querySelector("#count")?.textContent).toBe("1");
  });
});
