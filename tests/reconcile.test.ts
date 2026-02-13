import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "../src/refract/createElement.js";
import { render } from "../src/refract/render.js";

describe("reconcile", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("updates props on re-render", () => {
    render(createElement("img", { src: "old.jpg" }), container);
    render(createElement("img", { src: "new.jpg" }), container);

    const img = container.querySelector("img")!;
    expect(img.getAttribute("src")).toBe("new.jpg");
  });

  it("replaces node when type changes", () => {
    render(createElement("img", { src: "pic.jpg" }), container);
    render(createElement("span", null, "text"), container);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("span")).not.toBeNull();
    expect(container.querySelector("span")!.textContent).toBe("text");
  });

  it("updates text content", () => {
    render(createElement("span", null, "old"), container);
    render(createElement("span", null, "new"), container);

    expect(container.querySelector("span")!.textContent).toBe("new");
  });

  it("adds new children", () => {
    render(
      createElement("div", null, createElement("img", { src: "a.jpg" })),
      container,
    );
    render(
      createElement(
        "div",
        null,
        createElement("img", { src: "a.jpg" }),
        createElement("img", { src: "b.jpg" }),
      ),
      container,
    );

    expect(container.querySelector("div")!.querySelectorAll("img")).toHaveLength(2);
  });

  it("removes extra children", () => {
    render(
      createElement(
        "div",
        null,
        createElement("img", { src: "a.jpg" }),
        createElement("img", { src: "b.jpg" }),
      ),
      container,
    );
    render(
      createElement("div", null, createElement("img", { src: "a.jpg" })),
      container,
    );

    expect(container.querySelector("div")!.querySelectorAll("img")).toHaveLength(1);
  });

  it("removes old props that are no longer present", () => {
    render(createElement("img", { src: "pic.jpg", alt: "photo" }), container);
    render(createElement("img", { src: "pic.jpg" }), container);

    const img = container.querySelector("img")!;
    expect(img.getAttribute("alt")).toBeNull();
  });

  it("preserves the same DOM node across re-renders", () => {
    render(createElement("img", { src: "old.jpg" }), container);
    const imgBefore = container.querySelector("img")!;

    render(createElement("img", { src: "new.jpg" }), container);
    const imgAfter = container.querySelector("img")!;

    expect(imgBefore).toBe(imgAfter);
  });
});
