/** A functional component */
export type Component = (props: Props) => VNode;

/** The `type` field of a VNode — any HTML tag string, fragment symbol, or component */
export type VNodeType = string | symbol | Component;

/** Props passed to elements and components */
export interface Props {
  [key: string]: unknown;
  children?: VNode[] | VNode;
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
  _setter?: Function;
  _dispatch?: Function;
  _reducer?: Function;
  _fiber?: Fiber;
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
  _errorHandler?: (error: unknown) => void;
  alternate: Fiber | null;
  flags: number;
}
