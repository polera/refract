import type { Props, VNode } from "./types.js";

export const MEMO_MARKER = Symbol.for("refract.memo");

export interface MemoComponent {
  (props: Props): VNode;
  _inner: (props: Props) => VNode;
  _compare: (a: Record<string, unknown>, b: Record<string, unknown>) => boolean;
  _memo: typeof MEMO_MARKER;
}

export function isMemoComponent(type: unknown): type is MemoComponent {
  return typeof type === "function" && (type as MemoComponent)._memo === MEMO_MARKER;
}
