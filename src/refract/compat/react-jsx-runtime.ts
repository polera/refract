import { createElement, Fragment } from "../createElement.js";
import type { VNode, VNodeType } from "../types.js";

type JsxProps = Record<string, unknown> | null | undefined;
type JsxChild = VNode | string | number | boolean | null | undefined | JsxChild[];

// React compat: normalize props.children on the returned VNode so that
// a single child is stored directly (not in an array).  Libraries like
// MUI access `props.children.props` expecting a single React element.
// Refract's core createElement always stores children as an array, but
// the renderer's normalizeChildrenProp handles both formats, so this is safe.
function normalizeVNodeChildren(vnode: VNode): VNode {
  const c = vnode.props.children;
  if (Array.isArray(c) && c.length === 1) {
    vnode.props.children = c[0];
  }
  return vnode;
}

function createJsxElement(type: VNodeType, rawProps: JsxProps, key?: string): ReturnType<typeof createElement> {
  const props = { ...(rawProps ?? {}) };
  if (key !== undefined) {
    props.key = key;
  }
  const children = props.children as JsxChild | JsxChild[] | undefined;
  delete props.children;

  let vnode: VNode;
  if (children === undefined) {
    vnode = createElement(type, props);
  } else if (Array.isArray(children)) {
    vnode = createElement(type, props, ...(children as JsxChild[]));
  } else {
    vnode = createElement(type, props, children as JsxChild);
  }
  return normalizeVNodeChildren(vnode);
}

export function jsx(type: VNodeType, props: JsxProps, key?: string): ReturnType<typeof createElement> {
  return createJsxElement(type, props, key);
}

export function jsxs(type: VNodeType, props: JsxProps, key?: string): ReturnType<typeof createElement> {
  return createJsxElement(type, props, key);
}

export { Fragment };
