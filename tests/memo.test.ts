import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "../src/refract/createElement.js";
import { render } from "../src/refract/render.js";
import { memo } from "../src/refract/fiber.js";
import { useState, createRef } from "../src/refract/hooks.js";

describe("memo", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("skips re-render when props are shallowly equal", async () => {
    let childRenderCount = 0;
    const Child = memo((props: Record<string, unknown>) => {
      childRenderCount++;
      return createElement("span", null, props.text as string);
    });

    let setOther!: (v: number) => void;
    function App() {
      const [other, so] = useState(0);
      setOther = so;
      return createElement("div", null,
        createElement(Child, { text: "fixed" }),
        createElement("span", null, String(other)),
      );
    }

    render(createElement(App, null), container);
    expect(childRenderCount).toBe(1);

    setOther(1);
    await new Promise((r) => setTimeout(r, 10));
    // Child should NOT re-render because text prop didn't change
    expect(childRenderCount).toBe(1);
  });

  it("re-renders when props change", async () => {
    let childRenderCount = 0;
    const Child = memo((props: Record<string, unknown>) => {
      childRenderCount++;
      return createElement("span", null, props.text as string);
    });

    let setText!: (v: string) => void;
    function App() {
      const [text, st] = useState("hello");
      setText = st;
      return createElement("div", null,
        createElement(Child, { text }),
      );
    }

    render(createElement(App, null), container);
    expect(childRenderCount).toBe(1);

    setText("world");
    await new Promise((r) => setTimeout(r, 10));
    expect(childRenderCount).toBe(2);
    expect(container.querySelector("span")!.textContent).toBe("world");
  });

  it("supports custom compare function", async () => {
    let childRenderCount = 0;
    const Child = memo(
      (props: Record<string, unknown>) => {
        childRenderCount++;
        return createElement("span", null, String(props.value));
      },
      (a, b) => (a.value as number) % 2 === (b.value as number) % 2,
    );

    let setValue!: (v: number) => void;
    function App() {
      const [value, sv] = useState(0);
      setValue = sv;
      return createElement("div", null, createElement(Child, { value }));
    }

    render(createElement(App, null), container);
    expect(childRenderCount).toBe(1);

    // 0 -> 2, both even, should skip
    setValue(2);
    await new Promise((r) => setTimeout(r, 10));
    expect(childRenderCount).toBe(1);

    // 2 -> 3, even to odd, should re-render
    setValue(3);
    await new Promise((r) => setTimeout(r, 10));
    expect(childRenderCount).toBe(2);
  });
});

describe("refs", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("sets ref.current to DOM element", () => {
    const ref = createRef<HTMLSpanElement>();
    function App() {
      return createElement("span", { ref }, "hello");
    }
    render(createElement(App, null), container);
    expect(ref.current).toBe(container.querySelector("span"));
  });

  it("calls callback ref with DOM element", () => {
    let node: Node | null = null;
    function App() {
      return createElement("span", { ref: (el: Node | null) => { node = el; } }, "hello");
    }
    render(createElement(App, null), container);
    expect(node).toBe(container.querySelector("span"));
  });

  it("does not add ref as a DOM attribute", () => {
    const ref = createRef();
    function App() {
      return createElement("div", { ref, className: "test" });
    }
    render(createElement(App, null), container);
    const div = container.querySelector("div")!;
    expect(div.hasAttribute("ref")).toBe(false);
    expect(div.getAttribute("class")).toBe("test");
  });
});
