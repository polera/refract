import { describe, it, expect, beforeEach } from "vitest";
import { createElement, Fragment } from "../src/refract/createElement.js";
import { render } from "../src/refract/render.js";

describe("fragments", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("renders fragment children directly into parent", () => {
    const vnode = createElement(
      "div",
      null,
      createElement(Fragment as unknown as string, null,
        createElement("span", null, "a"),
        createElement("span", null, "b"),
      ),
    );
    render(vnode, container);

    const div = container.querySelector("div")!;
    expect(div.children).toHaveLength(2);
    expect(div.children[0].textContent).toBe("a");
    expect(div.children[1].textContent).toBe("b");
  });

  it("renders nested fragments", () => {
    const vnode = createElement(
      "div",
      null,
      createElement(Fragment as unknown as string, null,
        createElement(Fragment as unknown as string, null,
          createElement("span", null, "deep"),
        ),
        createElement("span", null, "shallow"),
      ),
    );
    render(vnode, container);

    const div = container.querySelector("div")!;
    expect(div.querySelectorAll("span")).toHaveLength(2);
    expect(div.children[0].textContent).toBe("deep");
    expect(div.children[1].textContent).toBe("shallow");
  });

  it("reconciles fragment children on re-render", () => {
    render(
      createElement("div", null,
        createElement(Fragment as unknown as string, null,
          createElement("span", null, "old"),
        ),
      ),
      container,
    );

    render(
      createElement("div", null,
        createElement(Fragment as unknown as string, null,
          createElement("span", null, "new"),
        ),
      ),
      container,
    );

    const div = container.querySelector("div")!;
    expect(div.querySelector("span")!.textContent).toBe("new");
  });

  it("handles fragment with mixed children", () => {
    const vnode = createElement(
      "div",
      null,
      createElement("span", null, "before"),
      createElement(Fragment as unknown as string, null,
        createElement("span", null, "frag1"),
        createElement("span", null, "frag2"),
      ),
      createElement("span", null, "after"),
    );
    render(vnode, container);

    const div = container.querySelector("div")!;
    const spans = div.querySelectorAll("span");
    expect(spans).toHaveLength(4);
    expect(spans[0].textContent).toBe("before");
    expect(spans[1].textContent).toBe("frag1");
    expect(spans[2].textContent).toBe("frag2");
    expect(spans[3].textContent).toBe("after");
  });
});
