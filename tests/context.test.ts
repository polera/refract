import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "../src/refract/createElement.js";
import { render } from "../src/refract/render.js";
import { createContext, useContext } from "../src/refract/context.js";

describe("context", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("provides default value when no Provider", () => {
    const ThemeCtx = createContext("light");
    function App() {
      const theme = useContext(ThemeCtx);
      return createElement("span", null, theme);
    }
    render(createElement(App, null), container);
    expect(container.querySelector("span")!.textContent).toBe("light");
  });

  it("provides value from Provider", () => {
    const ThemeCtx = createContext("light");
    function Child() {
      const theme = useContext(ThemeCtx);
      return createElement("span", null, theme);
    }
    function App() {
      return createElement(ThemeCtx.Provider, { value: "dark" },
        createElement(Child, null),
      );
    }
    render(createElement(App, null), container);
    expect(container.querySelector("span")!.textContent).toBe("dark");
  });

  it("uses nearest Provider value with nested providers", () => {
    const ThemeCtx = createContext("default");
    function Child() {
      const theme = useContext(ThemeCtx);
      return createElement("span", null, theme);
    }
    function App() {
      return createElement(ThemeCtx.Provider, { value: "outer" },
        createElement(ThemeCtx.Provider, { value: "inner" },
          createElement(Child, null),
        ),
      );
    }
    render(createElement(App, null), container);
    expect(container.querySelector("span")!.textContent).toBe("inner");
  });

  it("supports multiple contexts", () => {
    const ThemeCtx = createContext("light");
    const LangCtx = createContext("en");
    function Child() {
      const theme = useContext(ThemeCtx);
      const lang = useContext(LangCtx);
      return createElement("span", null, `${theme}-${lang}`);
    }
    function App() {
      return createElement(ThemeCtx.Provider, { value: "dark" },
        createElement(LangCtx.Provider, { value: "fr" },
          createElement(Child, null),
        ),
      );
    }
    render(createElement(App, null), container);
    expect(container.querySelector("span")!.textContent).toBe("dark-fr");
  });
});
