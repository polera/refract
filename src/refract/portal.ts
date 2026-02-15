import { createElement } from "./createElement.js";
import type { VNode } from "./types.js";

export const Portal = Symbol.for("refract.portal");

export type PortalChild = VNode | string | number | boolean | null | undefined | PortalChild[];

export function createPortal(
  children: PortalChild,
  container: Node,
  key?: string | number | null,
): VNode {
  const props: Record<string, unknown> = { container };
  if (key != null) {
    props.key = key;
  }
  return createElement(Portal, props, children);
}
