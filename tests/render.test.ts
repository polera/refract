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

  it("blocks javascript: URLs on URL attributes", () => {
    render(createElement("a", { href: "javascript:alert('xss')" }, "link"), container);
    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBeNull();
  });

  it("allows safe URLs on URL attributes", () => {
    render(createElement("a", { href: "https://example.com" }, "link"), container);
    const link = container.querySelector("a")!;
    expect(link.getAttribute("href")).toBe("https://example.com");
  });

  it("blocks javascript: URLs on SVG xlinkHref", () => {
    render(
      createElement(
        "svg",
        null,
        createElement("use", { xlinkHref: "javascript:alert('xss')" }),
      ),
      container,
    );

    const use = container.querySelector("use")!;
    expect(use.getAttribute("href")).toBeNull();
  });

  it("keeps camelCase SVG attributes as-is like Preact", () => {
    const vnode = createElement(
      "svg",
      { viewBox: "0 0 100 100" },
      createElement("g", { clipPath: "url(#sector-mask)" },
        createElement("path", {
          d: "M 10 10 L 20 20",
          strokeWidth: 6,
          strokeLinecap: "round",
          strokeLinejoin: "round",
          fillOpacity: 0.4,
        }),
      ),
    );
    render(vnode, container);

    const svg = container.querySelector("svg")!;
    const group = container.querySelector("g")!;
    const path = container.querySelector("path")!;

    expect(svg.getAttribute("viewBox")).toBe("0 0 100 100");
    expect(group.getAttribute("clipPath")).toBe("url(#sector-mask)");
    expect(path.getAttribute("strokeWidth")).toBe("6");
    expect(path.getAttribute("strokeLinecap")).toBe("round");
    expect(path.getAttribute("strokeLinejoin")).toBe("round");
    expect(path.getAttribute("fillOpacity")).toBe("0.4");
  });

  it("maps xlinkHref on SVG use elements", () => {
    const vnode = createElement(
      "svg",
      null,
      createElement("defs", null, createElement("path", { id: "slice", d: "M 0 0 L 5 5" })),
      createElement("use", { xlinkHref: "#slice" }),
    );
    render(vnode, container);

    const use = container.querySelector("use")!;
    expect(use.getAttribute("href")).toBe("#slice");
  });

  it("maps xlink:href prop alias on SVG use elements", () => {
    const vnode = createElement(
      "svg",
      null,
      createElement("use", { "xlink:href": "#slice" }),
    );
    render(vnode, container);

    const use = container.querySelector("use")!;
    expect(use.getAttribute("href")).toBe("#slice");
  });

  it("maps className to class on SVG elements", () => {
    render(createElement("svg", { className: "icon-wrap" }), container);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).toBe("icon-wrap");
  });

  it("preserves camelCase SVG attributes that are already camelCase in SVG", () => {
    const vnode = createElement(
      "svg",
      null,
      createElement(
        "linearGradient",
        { id: "g", gradientUnits: "userSpaceOnUse", gradientTransform: "rotate(25)" },
      ),
    );
    render(vnode, container);

    const gradient = container.querySelector("linearGradient")!;
    expect(gradient.getAttribute("gradientUnits")).toBe("userSpaceOnUse");
    expect(gradient.getAttribute("gradientTransform")).toBe("rotate(25)");
    expect(gradient.getAttribute("gradient-units")).toBeNull();
    expect(gradient.getAttribute("gradient-transform")).toBeNull();
  });

  it("keeps nested unknown SVG tags in SVG namespace", () => {
    const vnode = createElement(
      "svg",
      null,
      createElement("g", null, createElement("feSpotLight", { pointsAtX: 30 })),
    );
    render(vnode, container);

    const node = container.querySelector("feSpotLight")!;
    expect(node.namespaceURI).toBe("http://www.w3.org/2000/svg");
  });

  it("switches back to HTML namespace under foreignObject", () => {
    const vnode = createElement(
      "svg",
      null,
      createElement(
        "foreignObject",
        null,
        createElement("div", { className: "inside-fo" }, "hello"),
      ),
    );
    render(vnode, container);

    const div = container.querySelector("div")!;
    expect(div.namespaceURI).toBe("http://www.w3.org/1999/xhtml");
    expect(div.getAttribute("class")).toBe("inside-fo");
  });

  it("re-enters SVG namespace for nested svg inside foreignObject", () => {
    const vnode = createElement(
      "svg",
      null,
      createElement(
        "foreignObject",
        null,
        createElement("div", null, createElement("svg", null, createElement("path", { d: "M0 0" }))),
      ),
    );
    render(vnode, container);

    const nestedSvg = container.querySelector("foreignObject svg")!;
    const path = container.querySelector("foreignObject svg path")!;
    expect(nestedSvg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(path.namespaceURI).toBe("http://www.w3.org/2000/svg");
  });

  it("removes stale SVG attributes on rerender", () => {
    render(
      createElement("svg", null, createElement("path", { strokeWidth: 4, fillOpacity: 0.5 })),
      container,
    );
    render(
      createElement("svg", null, createElement("path", { fillOpacity: 1 })),
      container,
    );

    const path = container.querySelector("path")!;
    expect(path.getAttribute("strokeWidth")).toBeNull();
    expect(path.getAttribute("fillOpacity")).toBe("1");
  });
});
