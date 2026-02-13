import type { VNode } from "./types.js";
import { renderFiber } from "./coreRenderer.js";

/** Renders a VNode tree into a DOM container */
export function render(vnode: VNode, container: HTMLElement): void {
  renderFiber(vnode, container);
}
