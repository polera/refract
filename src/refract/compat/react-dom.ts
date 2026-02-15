import { createElement, Fragment } from "../createElement.js";
import { flushPendingRenders } from "../coreRenderer.js";
import { setReactCompatEventMode } from "../dom.js";
import { createPortal as createPortalImpl } from "../portal.js";
import type { PortalChild } from "../portal.js";
import { render } from "../render.js";

setReactCompatEventMode(true);

export function createPortal(children: PortalChild, container: Node, key?: string | number | null): ReturnType<typeof createPortalImpl> {
  return createPortalImpl(children, container, key);
}

export function unstable_batchedUpdates<T>(callback: () => T): T {
  return callback();
}

export function flushSync<T>(callback: () => T): T {
  const result = callback();
  flushPendingRenders();
  return result;
}

export function renderCompat(vnode: unknown, container: HTMLElement): void {
  render(vnode as Parameters<typeof render>[0], container);
}

export function unmountComponentAtNode(container: HTMLElement): boolean {
  render(createElement(Fragment, null), container);
  return true;
}

const ReactDomCompat = {
  createPortal,
  flushSync,
  render: renderCompat,
  unstable_batchedUpdates,
  unmountComponentAtNode,
};

export { renderCompat as render };
export default ReactDomCompat;
