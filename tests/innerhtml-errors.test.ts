import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "../src/refract/createElement.js";
import { render } from "../src/refract/render.js";
import { useState, useErrorBoundary } from "../src/refract/hooks.js";

describe("dangerouslySetInnerHTML", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("sets innerHTML from __html prop", () => {
    function App() {
      return createElement("div", {
        dangerouslySetInnerHTML: { __html: "<b>bold</b>" },
      });
    }
    render(createElement(App, null), container);
    expect(container.querySelector("div")!.innerHTML).toBe("<b>bold</b>");
  });

  it("skips children reconciliation when dangerouslySetInnerHTML is set", () => {
    function App() {
      return createElement("div", {
        dangerouslySetInnerHTML: { __html: "<b>bold</b>" },
      });
    }
    render(createElement(App, null), container);
    // The innerHTML should be set, not treated as a regular child
    const div = container.querySelector("div")!;
    expect(div.querySelector("b")).not.toBeNull();
    expect(div.querySelector("b")!.textContent).toBe("bold");
  });

  it("sanitizes dangerous tags and attributes", () => {
    function App() {
      return createElement("div", {
        dangerouslySetInnerHTML: {
          __html: `
            <img src="x" onerror="alert('xss')" />
            <a href="javascript:alert('xss')">click</a>
            <script>alert('xss')</script>
            <b>safe</b>
          `,
        },
      });
    }
    render(createElement(App, null), container);
    const div = container.querySelector("div")!;
    expect(div.querySelector("script")).toBeNull();
    expect(div.querySelector("img")!.getAttribute("onerror")).toBeNull();
    expect(div.querySelector("a")!.getAttribute("href")).toBeNull();
    expect(div.querySelector("b")!.textContent).toBe("safe");
  });

  it("throws when __html is not a string", () => {
    function App() {
      return createElement("div", {
        dangerouslySetInnerHTML: { __html: 123 as unknown as string },
      });
    }
    expect(() => render(createElement(App, null), container)).toThrow(
      "dangerouslySetInnerHTML expects a string __html value",
    );
  });
});

describe("useErrorBoundary", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("catches errors from child components", async () => {
    function Broken(): never {
      throw new Error("boom");
    }

    function ErrorBoundary() {
      const [error, resetError] = useErrorBoundary();
      if (error) {
        return createElement("span", null, "Error: " + (error as Error).message);
      }
      return createElement(Broken, null);
    }

    render(createElement(ErrorBoundary, null), container);
    // Error boundary triggers async re-render
    await new Promise((r) => setTimeout(r, 10));
    expect(container.querySelector("span")!.textContent).toBe("Error: boom");
  });

  it("renders children normally when no error", () => {
    function Good() {
      return createElement("span", null, "ok");
    }

    function ErrorBoundary() {
      const [error] = useErrorBoundary();
      if (error) {
        return createElement("span", null, "Error");
      }
      return createElement(Good, null);
    }

    render(createElement(ErrorBoundary, null), container);
    expect(container.querySelector("span")!.textContent).toBe("ok");
  });

  it("recovers after error reset", async () => {
    let shouldThrow = true;
    let resetFn!: () => void;

    function MaybeBreak() {
      if (shouldThrow) throw new Error("boom");
      return createElement("span", null, "recovered");
    }

    function ErrorBoundary() {
      const [error, resetError] = useErrorBoundary();
      resetFn = resetError;
      if (error) {
        return createElement("span", null, "caught");
      }
      return createElement(MaybeBreak, null);
    }

    render(createElement(ErrorBoundary, null), container);
    await new Promise((r) => setTimeout(r, 10));
    expect(container.querySelector("span")!.textContent).toBe("caught");

    shouldThrow = false;
    resetFn();
    await new Promise((r) => setTimeout(r, 10));
    expect(container.querySelector("span")!.textContent).toBe("recovered");
  });
});
