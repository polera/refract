import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "../src/refract/createElement.js";
import { render } from "../src/refract/render.js";

describe("render", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  it("renders a single img element", () => {
    const vnode = createElement("img", { src: "cat.jpg", alt: "A cat" });
    render(vnode, container);

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.getAttribute("src")).toBe("cat.jpg");
    expect(img!.getAttribute("alt")).toBe("A cat");
  });

  it("renders nested elements", () => {
    const vnode = createElement(
      "div",
      { className: "gallery" },
      createElement("img", { src: "a.jpg" }),
      createElement("img", { src: "b.jpg" }),
    );
    render(vnode, container);

    const div = container.querySelector("div");
    expect(div).not.toBeNull();
    expect(div!.getAttribute("class")).toBe("gallery");
    expect(div!.querySelectorAll("img")).toHaveLength(2);
  });

  it("renders text nodes", () => {
    const vnode = createElement("span", null, "Hello world");
    render(vnode, container);

    const span = container.querySelector("span");
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("Hello world");
  });

  it("renders functional components", () => {
    const ImageCard = (props: Record<string, unknown>) =>
      createElement(
        "div",
        { className: "card" },
        createElement("img", { src: props.src as string }),
        createElement("span", null, props.caption as string),
      );

    render(createElement(ImageCard, { src: "pic.jpg", caption: "Nice" }), container);

    expect(container.querySelector("img")!.getAttribute("src")).toBe("pic.jpg");
    expect(container.querySelector("span")!.textContent).toBe("Nice");
  });

  it("attaches event listeners", () => {
    let clicked = false;
    const vnode = createElement("div", { onClick: () => { clicked = true; } });
    render(vnode, container);

    const div = container.querySelector("div")!;
    div.click();
    expect(clicked).toBe(true);
  });
});
