import type { VNode, Fiber, Props } from "./types.js";
import { PLACEMENT, UPDATE, DELETION } from "./types.js";
import { reconcileChildren } from "./reconcile.js";

/** Module globals for hook system */
export let currentFiber: Fiber | null = null;
export let hookIndex = 0;

/** Store root fiber per container */
const roots = new WeakMap<Node, Fiber>();
let deletions: Fiber[] = [];

export function pushDeletion(fiber: Fiber): void {
  deletions.push(fiber);
}

/** Create a real DOM node from a fiber */
export function createDom(fiber: Fiber): Node {
  if (fiber.type === "TEXT") {
    return document.createTextNode(fiber.props.nodeValue as string);
  }
  const el = document.createElement(fiber.type as string);
  applyProps(el, {}, fiber.props);
  return el;
}

/** Apply props to a DOM element, diffing against old props */
export function applyProps(
  el: HTMLElement,
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
): void {
  for (const key of Object.keys(oldProps)) {
    if (key === "children" || key === "key") continue;
    if (!(key in newProps)) {
      if (key.startsWith("on")) {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key] as EventListener);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  for (const key of Object.keys(newProps)) {
    if (key === "children" || key === "key") continue;
    if (oldProps[key] === newProps[key]) continue;

    if (key.startsWith("on")) {
      const event = key.slice(2).toLowerCase();
      if (oldProps[key]) {
        el.removeEventListener(event, oldProps[key] as EventListener);
      }
      el.addEventListener(event, newProps[key] as EventListener);
    } else if (key === "className") {
      el.setAttribute("class", newProps[key] as string);
    } else if (key === "style" && typeof newProps[key] === "object") {
      const styles = newProps[key] as Record<string, string>;
      for (const [prop, val] of Object.entries(styles)) {
        (el.style as unknown as Record<string, string>)[prop] = val;
      }
    } else {
      el.setAttribute(key, String(newProps[key]));
    }
  }
}

/** Render a VNode tree into a container (entry point) */
export function renderFiber(vnode: VNode, container: Node): void {
  const oldRoot = roots.get(container) ?? null;

  const rootFiber: Fiber = {
    type: "div",
    props: { children: [vnode] },
    key: null,
    dom: container,
    parentDom: container,
    parent: null,
    child: null,
    sibling: null,
    hooks: null,
    alternate: oldRoot,
    flags: UPDATE,
  };
  deletions = [];
  performWork(rootFiber);
  commitRoot(rootFiber);
  roots.set(container, rootFiber);
}

/** Depth-first work loop: call components, diff children */
function performWork(fiber: Fiber): void {
  const isComponent = typeof fiber.type === "function";

  if (isComponent) {
    currentFiber = fiber;
    hookIndex = 0;
    if (!fiber.hooks) fiber.hooks = [];

    const comp = fiber.type as (props: Props) => VNode;
    const children = [comp(fiber.props)];
    reconcileChildren(fiber, children);
  } else {
    if (!fiber.dom) {
      fiber.dom = createDom(fiber);
    }
    reconcileChildren(fiber, fiber.props.children ?? []);
  }

  // Traverse: child first, then sibling, then uncle
  if (fiber.child) {
    performWork(fiber.child);
    return;
  }

  let next: Fiber | null = fiber;
  while (next) {
    if (next.sibling) {
      performWork(next.sibling);
      return;
    }
    next = next.parent;
  }
}

/** Commit all DOM mutations */
function commitRoot(rootFiber: Fiber): void {
  for (const fiber of deletions) {
    commitDeletion(fiber);
  }
  if (rootFiber.child) {
    commitWork(rootFiber.child);
  }
}

function commitWork(fiber: Fiber): void {
  let parentFiber = fiber.parent;
  while (parentFiber && !parentFiber.dom) {
    parentFiber = parentFiber.parent;
  }
  const parentDom = parentFiber!.dom!;

  if (fiber.flags & PLACEMENT && fiber.dom) {
    parentDom.appendChild(fiber.dom);
  } else if (fiber.flags & UPDATE && fiber.dom) {
    if (fiber.type === "TEXT") {
      const oldValue = fiber.alternate?.props.nodeValue;
      if (oldValue !== fiber.props.nodeValue) {
        fiber.dom.textContent = fiber.props.nodeValue as string;
      }
    } else {
      applyProps(
        fiber.dom as HTMLElement,
        fiber.alternate?.props ?? {},
        fiber.props,
      );
    }
  }

  fiber.flags = 0;

  if (fiber.child) commitWork(fiber.child);
  if (fiber.sibling) commitWork(fiber.sibling);
}

function commitDeletion(fiber: Fiber): void {
  if (fiber.dom) {
    fiber.dom.parentNode?.removeChild(fiber.dom);
  } else if (fiber.child) {
    commitDeletion(fiber.child);
  }
}

/** Schedule a re-render of a fiber (used by useState) */
export function scheduleRender(fiber: Fiber): void {
  let root = fiber;
  while (root.parent) {
    root = root.parent;
  }

  const container = root.dom!;
  queueMicrotask(() => {
    const currentRoot = roots.get(container);
    if (!currentRoot) return;

    const newRoot: Fiber = {
      type: currentRoot.type,
      props: currentRoot.props,
      key: currentRoot.key,
      dom: currentRoot.dom,
      parentDom: currentRoot.parentDom,
      parent: null,
      child: null,
      sibling: null,
      hooks: null,
      alternate: currentRoot,
      flags: UPDATE,
    };
    deletions = [];
    performWork(newRoot);
    commitRoot(newRoot);
    roots.set(container, newRoot);
  });
}
