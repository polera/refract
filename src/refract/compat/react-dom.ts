import { createElement, Fragment } from "../createElement.js";
import { flushPendingRenders } from "../coreRenderer.js";
import { flushPassiveEffects } from "../hooksRuntime.js";
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

// findDOMNode was removed in React 19. react-transition-group v4 calls it
// when no nodeRef prop is provided. Returning null avoids a hard crash; any
// guarded usage (if node) degrades gracefully while unguarded usage (e.g.
// CSSTransition without nodeRef) will silently skip the animation.
export function findDOMNode(_instance: unknown): Element | null {
  return null;
}

export function flushSync<T>(callback: () => T): T {
  const result = callback();
  flushPendingRenders();
  flushPassiveEffects();
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
  findDOMNode,
  flushSync,
  render: renderCompat,
  unstable_batchedUpdates,
  unmountComponentAtNode,
};

export { renderCompat as render };
export default ReactDomCompat;
