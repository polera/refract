/** A functional component */
export type Component = (props: Props) => VNode;

/** The `type` field of a VNode — any HTML tag string or a component function */
export type VNodeType = string | Component;

/** Props passed to elements and components */
export interface Props {
  [key: string]: unknown;
  children?: VNode[];
  key?: string | number;
}

/** A virtual DOM node */
export interface VNode {
  type: VNodeType | "TEXT";
  props: Props;
  key: string | number | null;
}

/** Fiber flags for commit phase */
export const PLACEMENT = 1;
export const UPDATE = 2;
export const DELETION = 4;

/** A hook state slot */
export interface Hook {
  state: unknown;
  queue?: unknown[];
}

/** Internal fiber node — represents a mounted VNode */
export interface Fiber {
  type: VNodeType | "TEXT";
  props: Props;
  key: string | number | null;
  dom: Node | null;
  parentDom: Node;
  parent: Fiber | null;
  child: Fiber | null;
  sibling: Fiber | null;
  hooks: Hook[] | null;
  _hookIndex?: number;
  _contexts?: Map<number, unknown>;
  alternate: Fiber | null;
  flags: number;
}
