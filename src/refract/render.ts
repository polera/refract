import type { VNode } from "./types.js";
import { renderFiber } from "./coreRenderer.js";
import { ensureSecurityDefaults } from "./features/security.js";

/** Renders a VNode tree into a DOM container with security defaults */
export function render(vnode: VNode, container: HTMLElement): void {
  ensureSecurityDefaults();
  renderFiber(vnode, container);
}
