import { createElement, Fragment } from "../createElement.js";
import { render } from "../render.js";
import { setReactCompatEventMode } from "../dom.js";

setReactCompatEventMode(true);

export interface RefractCompatRoot {
  render(children: unknown): void;
  unmount(): void;
}

export function createRoot(container: HTMLElement): RefractCompatRoot {
  return {
    render(children: unknown): void {
      render(children as Parameters<typeof render>[0], container);
    },
    unmount(): void {
      render(createElement(Fragment, null), container);
    },
  };
}

export function hydrateRoot(container: HTMLElement, children: unknown): RefractCompatRoot {
  const root = createRoot(container);
  root.render(children);
  return root;
}
