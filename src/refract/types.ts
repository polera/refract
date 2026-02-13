/** Allowed HTML tag names */
export type Tag = "div" | "span" | "img";

/** A functional component */
export type Component = (props: Props) => VNode;

/** The `type` field of a VNode — either an HTML tag or a component function */
export type VNodeType = Tag | Component;

/** Props passed to elements and components */
export interface Props {
  [key: string]: unknown;
  children?: VNode[];
}

/** A virtual DOM node */
export interface VNode {
  type: VNodeType | "TEXT";
  props: Props;
}

/** Internal reference stored on a mounted DOM container */
export interface MountedRoot {
  __refract_vnode?: VNode;
}
