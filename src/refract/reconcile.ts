import type { VNode } from "./types.js";
import { createDom, applyProps } from "./render.js";

/**
 * Reconciles the DOM at `parent.childNodes[index]` from oldVNode to newVNode.
 * Performs minimal DOM mutations.
 */
export function reconcile(
  parent: Node,
  oldVNode: VNode,
  newVNode: VNode,
  index: number,
): void {
  const existingNode = parent.childNodes[index];

  // Node doesn't exist yet — append
  if (!existingNode) {
    parent.appendChild(createDom(newVNode));
    return;
  }

  // Type changed — replace the entire node
  if (oldVNode.type !== newVNode.type) {
    parent.replaceChild(createDom(newVNode), existingNode);
    return;
  }

  // Text node — update value if needed
  if (newVNode.type === "TEXT") {
    if (oldVNode.props.nodeValue !== newVNode.props.nodeValue) {
      existingNode.textContent = newVNode.props.nodeValue as string;
    }
    return;
  }

  // Same element type — diff props and recurse into children
  applyProps(
    existingNode as HTMLElement,
    oldVNode.props,
    newVNode.props,
  );

  const oldChildren = oldVNode.props.children ?? [];
  const newChildren = newVNode.props.children ?? [];
  const maxLen = Math.max(oldChildren.length, newChildren.length);

  for (let i = 0; i < maxLen; i++) {
    if (i >= newChildren.length) {
      // Extra old child — remove it (always remove the last one)
      const child = existingNode.childNodes[newChildren.length];
      if (child) existingNode.removeChild(child);
    } else if (i >= oldChildren.length) {
      // New child — append
      existingNode.appendChild(createDom(newChildren[i]));
    } else {
      // Both exist — reconcile
      reconcile(existingNode, oldChildren[i], newChildren[i], i);
    }
  }
}
