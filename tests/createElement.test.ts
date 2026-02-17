import { describe, it, expect } from "vitest";
import { createElement } from "../src/refract/createElement.js";

describe("createElement", () => {
  it("creates a simple element with no children", () => {
    const vnode = createElement("img", { src: "cat.jpg", alt: "A cat" });
    expect(vnode.type).toBe("img");
    expect(vnode.props.src).toBe("cat.jpg");
    expect(vnode.props.alt).toBe("A cat");
    expect(vnode.props.children).toBeUndefined();
    expect(vnode.key).toBeNull();
  });

  it("creates an element with string children as text nodes", () => {
    const vnode = createElement("span", null, "hello");
    expect(vnode.props.children).toHaveLength(1);
    expect((vnode.props.children as unknown as any[])[0].type).toBe("TEXT");
    expect((vnode.props.children as unknown as any[])[0].props.nodeValue).toBe("hello");
  });

  it("creates nested elements", () => {
    const vnode = createElement(
      "div",
      { className: "card" },
      createElement("img", { src: "pic.jpg" }),
      createElement("span", null, "Caption"),
    );
    expect(vnode.type).toBe("div");
    expect(vnode.props.children).toHaveLength(2);
    expect((vnode.props.children as unknown as any[])[0].type).toBe("img");
    expect((vnode.props.children as unknown as any[])[1].type).toBe("span");
  });

  it("flattens array children", () => {
    const items = ["a", "b", "c"];
    const vnode = createElement(
      "div",
      null,
      items.map((t) => createElement("span", null, t)),
    );
    expect(vnode.props.children).toHaveLength(3);
  });

  it("filters out null, undefined, and boolean children", () => {
    const vnode = createElement("div", null, null, undefined, false, true, "text");
    expect(vnode.props.children).toHaveLength(1);
    expect((vnode.props.children as unknown as any[])[0].type).toBe("TEXT");
  });

  it("retains function type for components (deferred)", () => {
    const MyImg = (props: Record<string, unknown>) =>
      createElement("img", { src: props.src as string });

    const vnode = createElement(MyImg, { src: "photo.jpg" });
    // Components are NOT called eagerly — type stays as the function
    expect(vnode.type).toBe(MyImg);
    expect(vnode.props.src).toBe("photo.jpg");
  });

  it("converts numbers to text nodes", () => {
    const vnode = createElement("span", null, 42);
    expect(vnode.props.children).toHaveLength(1);
    expect((vnode.props.children as unknown as any[])[0].props.nodeValue).toBe("42");
  });

  it("extracts key from props", () => {
    const vnode = createElement("div", { key: "abc", className: "x" });
    expect(vnode.key).toBe("abc");
    expect(vnode.props.key).toBeUndefined();
  });
});
