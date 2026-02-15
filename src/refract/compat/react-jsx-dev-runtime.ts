import { Fragment, jsx } from "./react-jsx-runtime.js";
import type { VNodeType } from "../types.js";

type JsxProps = Record<string, unknown> | null | undefined;

export function jsxDEV(
  type: VNodeType,
  props: JsxProps,
  key?: string,
): ReturnType<typeof jsx> {
  return jsx(type, props, key);
}

export { Fragment };

