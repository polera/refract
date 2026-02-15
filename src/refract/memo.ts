import type { Props, VNode } from "./types.js";
import { MEMO_MARKER, type MemoComponent } from "./memoMarker.js";
import { ensureMemoRuntime } from "./features/memoRuntime.js";

/** Shallow equality comparison for memo */
export function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const key of keysA) {
    if (key === "children") continue;
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}

export function memo(
  component: (props: Props) => VNode,
  compare?: (a: Record<string, unknown>, b: Record<string, unknown>) => boolean,
): (props: Props) => VNode {
  ensureMemoRuntime();
  const memoComp: MemoComponent = ((props: Props) => component(props)) as MemoComponent;
  memoComp._inner = component;
  memoComp._compare = compare ?? shallowEqual;
  memoComp._memo = MEMO_MARKER;
  return memoComp;
}
