import type { VNode, MountedRoot } from "./types.js";
import { reconcile } from "./reconcile.js";

/**
 * Renders a VNode tree into a DOM container.
 * On subsequent calls with the same container, reconciles against the previous tree.
 */
export function render(vnode: VNode, container: HTMLElement): void {
  const root = container as HTMLElement & MountedRoot;
  const oldVNode = root.__refract_vnode ?? null;

  if (oldVNode === null) {
    // First mount
    const dom = createDom(vnode);
    container.appendChild(dom);
  } else {
    // Re-render: reconcile against previous tree
    reconcile(container, oldVNode, vnode, 0);
  }

  root.__refract_vnode = vnode;
}

/** Recursively create real DOM nodes from a VNode tree */
export function createDom(vnode: VNode): Node {
  if (vnode.type === "TEXT") {
    return document.createTextNode(vnode.props.nodeValue as string);
  }

  const el = document.createElement(vnode.type as string);
  applyProps(el, {}, vnode.props);

  const children = vnode.props.children ?? [];
  for (const child of children) {
    el.appendChild(createDom(child));
  }

  return el;
}

/** Apply props to a DOM element, diffing against old props */
export function applyProps(
  el: HTMLElement,
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
): void {
  // Remove old props not in new
  for (const key of Object.keys(oldProps)) {
    if (key === "children") continue;
    if (!(key in newProps)) {
      if (key.startsWith("on")) {
        const event = key.slice(2).toLowerCase();
        el.removeEventListener(event, oldProps[key] as EventListener);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  // Set new props
  for (const key of Object.keys(newProps)) {
    if (key === "children") continue;
    if (oldProps[key] === newProps[key]) continue;

    if (key.startsWith("on")) {
      const event = key.slice(2).toLowerCase();
      if (oldProps[key]) {
        el.removeEventListener(event, oldProps[key] as EventListener);
      }
      el.addEventListener(event, newProps[key] as EventListener);
    } else if (key === "className") {
      el.setAttribute("class", newProps[key] as string);
    } else if (key === "style" && typeof newProps[key] === "object") {
      const styles = newProps[key] as Record<string, string>;
      for (const [prop, val] of Object.entries(styles)) {
        (el.style as unknown as Record<string, string>)[prop] = val;
      }
    } else {
      el.setAttribute(key, String(newProps[key]));
    }
  }
}
