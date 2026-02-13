import type { VNode, VNodeType, Props } from "./types.js";

type Child = VNode | string | number | boolean | null | undefined | Child[];

export function createElement(
  type: VNodeType,
  props: Record<string, unknown> | null,
  ...rawChildren: Child[]
): VNode {
  const resolvedProps: Props = { ...(props ?? {}) };

  // Extract key from props
  const key = resolvedProps.key ?? null;
  delete resolvedProps.key;

  const children = flattenChildren(rawChildren);
  if (children.length > 0) {
    resolvedProps.children = children;
  }

  // Do NOT call component functions — they are called during reconciliation
  return { type, props: resolvedProps, key };
}

function flattenChildren(raw: Child[]): VNode[] {
  const result: VNode[] = [];
  for (const child of raw) {
    if (child == null || typeof child === "boolean") continue;
    if (Array.isArray(child)) {
      result.push(...flattenChildren(child));
    } else if (typeof child === "string" || typeof child === "number") {
      result.push({ type: "TEXT", props: { nodeValue: String(child) }, key: null });
    } else {
      result.push(child);
    }
  }
  return result;
}
