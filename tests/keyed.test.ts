import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "../src/refract/createElement.js";
import { render } from "../src/refract/render.js";

describe("keyed reconciliation", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("reorders keyed children without recreating DOM nodes", () => {
    render(
      createElement("div", null,
        createElement("span", { key: "a" }, "A"),
        createElement("span", { key: "b" }, "B"),
        createElement("span", { key: "c" }, "C"),
      ),
      container,
    );

    const div = container.querySelector("div")!;
    const [spanA, spanB, spanC] = Array.from(div.children);

    // Reverse order
    render(
      createElement("div", null,
        createElement("span", { key: "c" }, "C"),
        createElement("span", { key: "b" }, "B"),
        createElement("span", { key: "a" }, "A"),
      ),
      container,
    );

    // DOM nodes should be reused (same references)
    const children = Array.from(div.children);
    expect(children[0]).toBe(spanC);
    expect(children[1]).toBe(spanB);
    expect(children[2]).toBe(spanA);
  });

  it("inserts a new keyed child", () => {
    render(
      createElement("div", null,
        createElement("span", { key: "a" }, "A"),
        createElement("span", { key: "c" }, "C"),
      ),
      container,
    );

    const div = container.querySelector("div")!;
    const spanA = div.children[0];
    const spanC = div.children[1];

    render(
      createElement("div", null,
        createElement("span", { key: "a" }, "A"),
        createElement("span", { key: "b" }, "B"),
        createElement("span", { key: "c" }, "C"),
      ),
      container,
    );

    expect(div.children).toHaveLength(3);
    expect(div.children[0]).toBe(spanA);
    expect(div.children[1].textContent).toBe("B");
    expect(div.children[2]).toBe(spanC);
  });

  it("removes a keyed child", () => {
    render(
      createElement("div", null,
        createElement("span", { key: "a" }, "A"),
        createElement("span", { key: "b" }, "B"),
        createElement("span", { key: "c" }, "C"),
      ),
      container,
    );

    const div = container.querySelector("div")!;
    const spanA = div.children[0];
    const spanC = div.children[2];

    render(
      createElement("div", null,
        createElement("span", { key: "a" }, "A"),
        createElement("span", { key: "c" }, "C"),
      ),
      container,
    );

    expect(div.children).toHaveLength(2);
    expect(div.children[0]).toBe(spanA);
    expect(div.children[1]).toBe(spanC);
  });

  it("handles shuffle (move to front)", () => {
    render(
      createElement("div", null,
        createElement("span", { key: "a" }, "A"),
        createElement("span", { key: "b" }, "B"),
        createElement("span", { key: "c" }, "C"),
      ),
      container,
    );

    const div = container.querySelector("div")!;
    const spanC = div.children[2];

    // Move C to front
    render(
      createElement("div", null,
        createElement("span", { key: "c" }, "C"),
        createElement("span", { key: "a" }, "A"),
        createElement("span", { key: "b" }, "B"),
      ),
      container,
    );

    expect(div.children).toHaveLength(3);
    expect(div.children[0]).toBe(spanC);
    expect(div.children[0].textContent).toBe("C");
    expect(div.children[1].textContent).toBe("A");
    expect(div.children[2].textContent).toBe("B");
  });
});
