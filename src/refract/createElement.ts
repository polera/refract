import type { VNode, VNodeType, Props } from "./types.js";

type Child = VNode | string | number | boolean | null | undefined | Child[];

/**
 * Creates a virtual DOM node.
 *
 * Usage:
 *   createElement("img", { src: "photo.jpg", alt: "A photo" })
 *   createElement("div", null, child1, child2)
 *   createElement(MyComponent, { title: "hello" })
 */
export function createElement(
  type: VNodeType,
  props: Record<string, unknown> | null,
  ...rawChildren: Child[]
): VNode {
  const resolvedProps: Props = { ...(props ?? {}) };

  // Flatten and normalize children
  const children = flattenChildren(rawChildren);
  if (children.length > 0) {
    resolvedProps.children = children;
  }

  // If type is a functional component, call it
  if (typeof type === "function") {
    return type(resolvedProps);
  }

  return { type, props: resolvedProps };
}

/** Convert raw children into VNode[] — strings become text nodes */
function flattenChildren(raw: Child[]): VNode[] {
  const result: VNode[] = [];
  for (const child of raw) {
    if (child == null || typeof child === "boolean") continue;
    if (Array.isArray(child)) {
      result.push(...flattenChildren(child));
    } else if (typeof child === "string" || typeof child === "number") {
      result.push({ type: "TEXT", props: { nodeValue: String(child) } });
    } else {
      result.push(child);
    }
  }
  return result;
}
