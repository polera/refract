import { createElement, Fragment } from "../createElement.js";
import type { VNode, VNodeType } from "../types.js";

type JsxProps = Record<string, unknown> | null | undefined;
type JsxChild = VNode | string | number | boolean | null | undefined | JsxChild[];

function createJsxElement(type: VNodeType, rawProps: JsxProps, key?: string): ReturnType<typeof createElement> {
  const props = { ...(rawProps ?? {}) };
  if (key !== undefined) {
    props.key = key;
  }
  const children = props.children as JsxChild | JsxChild[] | undefined;
  delete props.children;

  if (children === undefined) {
    return createElement(type, props);
  }
  if (Array.isArray(children)) {
    return createElement(type, props, ...(children as JsxChild[]));
  }
  return createElement(type, props, children as JsxChild);
}

export function jsx(type: VNodeType, props: JsxProps, key?: string): ReturnType<typeof createElement> {
  return createJsxElement(type, props, key);
}

export function jsxs(type: VNodeType, props: JsxProps, key?: string): ReturnType<typeof createElement> {
  return createJsxElement(type, props, key);
}

export { Fragment };
