import type { VNode, Fiber, Props } from "./types.js";
import { PLACEMENT, UPDATE } from "./types.js";
import { reconcileChildren } from "./reconcile.js";
import { Fragment } from "./createElement.js";
import { Portal } from "./portal.js";
import { createDom, applyProps } from "./dom.js";
import {
  runAfterComponentRenderHandlers,
  runAfterCommitHandlers,
  runBeforeComponentRenderHandlers,
  runCommitHandlers,
  runFiberCleanupHandlers,
  shouldBailoutComponent,
  tryHandleRenderError,
} from "./runtimeExtensions.js";

/** Module globals for hook system */
export let currentFiber: Fiber | null = null;

/** Store root fiber per container */
const roots = new WeakMap<Node, Fiber>();
let deletions: Fiber[] = [];

export function pushDeletion(fiber: Fiber): void {
  deletions.push(fiber);
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
  const committedDeletions = deletions.slice();
  commitRoot(rootFiber);
  runAfterCommitHandlers();
  roots.set(container, rootFiber);
  runCommitHandlers(rootFiber, committedDeletions);
}

/** Depth-first work loop: call components, diff children */
function performWork(fiber: Fiber): void {
  const isComponent = typeof fiber.type === "function";
  const isFragment = fiber.type === Fragment;
  const isPortal = fiber.type === Portal;

  if (isComponent) {
    if (fiber.alternate && fiber.flags === UPDATE && shouldBailoutComponent(fiber)) {
      return advanceWork(fiber);
    }

    currentFiber = fiber;
    fiber._hookIndex = 0;
    if (!fiber.hooks) fiber.hooks = [];

    const comp = fiber.type as (props: Props) => unknown;
    runBeforeComponentRenderHandlers(fiber);
    try {
      const children = normalizeRenderedChildren(comp(fiber.props));
      reconcileChildren(fiber, children);
    } catch (error) {
      if (!tryHandleRenderError(fiber, error)) throw error;
    } finally {
      runAfterComponentRenderHandlers(fiber);
    }
  } else if (isFragment) {
    reconcileChildren(fiber, normalizeChildrenProp(fiber.props.children));
  } else if (isPortal) {
    const container = fiber.props.container;
    if (!(container instanceof Node)) {
      throw new TypeError("createPortal expects a valid DOM Node container");
    }
    fiber.dom = container;
    reconcileChildren(fiber, normalizeChildrenProp(fiber.props.children));
  } else {
    if (!fiber.dom) {
      fiber.dom = createDom(fiber);
    }
    // Skip children when dangerouslySetInnerHTML is used
    if (!fiber.props.dangerouslySetInnerHTML) {
      reconcileChildren(fiber, normalizeChildrenProp(fiber.props.children));
    }
  }

  // Traverse: child first, then sibling, then uncle
  if (fiber.child) {
    performWork(fiber.child);
    return;
  }

  advanceWork(fiber);
}

type RenderedChild = VNode | string | number | boolean | null | undefined | RenderedChild[];

function normalizeRenderedChildren(rendered: unknown): VNode[] {
  return flattenRenderedChildren([rendered as RenderedChild]);
}

function normalizeChildrenProp(children: unknown): VNode[] {
  if (children === undefined) return [];
  if (Array.isArray(children)) {
    return flattenRenderedChildren(children as RenderedChild[]);
  }
  return flattenRenderedChildren([children as RenderedChild]);
}

function flattenRenderedChildren(raw: RenderedChild[]): VNode[] {
  const result: VNode[] = [];
  for (const child of raw) {
    if (child == null || typeof child === "boolean") continue;
    if (Array.isArray(child)) {
      result.push(...flattenRenderedChildren(child));
      continue;
    }
    if (typeof child === "string" || typeof child === "number") {
      result.push({ type: "TEXT", props: { nodeValue: String(child) }, key: null });
      continue;
    }
    result.push(child);
  }
  return result;
}

function isPortalFiber(fiber: Fiber): boolean {
  return fiber.type === Portal;
}

function advanceWork(fiber: Fiber): void {
  let next: Fiber | null = fiber;
  while (next) {
    if (next.sibling) {
      performWork(next.sibling);
      return;
    }
    next = next.parent;
  }
}

/** Find the next DOM sibling for insertion (skips siblings being placed/moved) */
function getNextDomSibling(fiber: Fiber): Node | null {
  let sib: Fiber | null = fiber.sibling;
  while (sib) {
    if (isPortalFiber(sib)) {
      sib = sib.sibling;
      continue;
    }
    // Skip any sibling that is itself being placed/moved
    if (sib.flags & PLACEMENT) {
      sib = sib.sibling;
      continue;
    }
    if (sib.dom) return sib.dom;
    if (sib.child) {
      const childDom = getFirstCommittedDom(sib);
      if (childDom) return childDom;
    }
    sib = sib.sibling;
  }
  return null;
}

/** Collect all DOM nodes from a component/fragment fiber's subtree */
function collectChildDomNodes(fiber: Fiber): Node[] {
  const nodes: Node[] = [];
  function walk(f: Fiber | null): void {
    while (f) {
      if (isPortalFiber(f)) {
        f = f.sibling;
        continue;
      }
      if (f.dom) {
        nodes.push(f.dom);
      } else {
        walk(f.child);
      }
      f = f.sibling;
    }
  }
  walk(fiber.child);
  return nodes;
}

/** Get the first committed DOM node in a fiber subtree */
function getFirstCommittedDom(fiber: Fiber): Node | null {
  if (isPortalFiber(fiber)) return null;
  if (fiber.dom && !(fiber.flags & PLACEMENT)) return fiber.dom;
  let child = fiber.child;
  while (child) {
    const dom = getFirstCommittedDom(child);
    if (dom) return dom;
    child = child.sibling;
  }
  return null;
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
  if (isPortalFiber(fiber)) {
    fiber.flags = 0;
    if (fiber.child) commitWork(fiber.child);
    if (fiber.sibling) commitWork(fiber.sibling);
    return;
  }

  let parentFiber = fiber.parent;
  while (parentFiber && !parentFiber.dom) {
    parentFiber = parentFiber.parent;
  }
  const parentDom = parentFiber!.dom!;

  if (fiber.flags & PLACEMENT) {
    if (fiber.dom) {
      const before = getNextDomSibling(fiber);
      if (before) {
        parentDom.insertBefore(fiber.dom, before);
      } else {
        parentDom.appendChild(fiber.dom);
      }
    } else {
      // Component/fragment: move all child DOM nodes
      const domNodes = collectChildDomNodes(fiber);
      const before = getNextDomSibling(fiber);
      for (const dom of domNodes) {
        if (before) {
          parentDom.insertBefore(dom, before);
        } else {
          parentDom.appendChild(dom);
        }
      }
    }
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

  // Handle ref prop
  if (fiber.dom && fiber.props.ref) {
    setRef(fiber.props.ref, fiber.dom);
  }

  fiber.flags = 0;

  if (fiber.child) commitWork(fiber.child);
  if (fiber.sibling) commitWork(fiber.sibling);
}

function setRef(ref: unknown, value: Node | null): void {
  if (typeof ref === "function") {
    ref(value);
  } else if (ref && typeof ref === "object" && "current" in ref) {
    (ref as { current: unknown }).current = value;
  }
}

function commitDeletion(fiber: Fiber): void {
  runCleanups(fiber);
  // Clear ref on unmount
  if (fiber.dom && fiber.props.ref) {
    setRef(fiber.props.ref, null);
  }
  if (isPortalFiber(fiber)) {
    let child: Fiber | null = fiber.child;
    while (child) {
      commitDeletion(child);
      child = child.sibling;
    }
  } else if (fiber.dom) {
    fiber.dom.parentNode?.removeChild(fiber.dom);
  } else if (fiber.child) {
    // Fragment/component — delete children
    let child: Fiber | null = fiber.child;
    while (child) {
      commitDeletion(child);
      child = child.sibling;
    }
  }
}

function runCleanups(fiber: Fiber): void {
  runFiberCleanupHandlers(fiber);
  if (fiber.child) runCleanups(fiber.child);
  if (fiber.sibling) runCleanups(fiber.sibling);
}

const pendingContainers = new Set<Node>();
let flushScheduled = false;

export function scheduleRender(fiber: Fiber): void {
  let root = fiber;
  while (root.parent) {
    root = root.parent;
  }
  pendingContainers.add(root.dom!);

  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushRenders);
  }
}

function flushRenders(): void {
  flushScheduled = false;
  for (const container of pendingContainers) {
    const currentRoot = roots.get(container);
    if (!currentRoot) continue;

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
    const committedDeletions = deletions.slice();
    commitRoot(newRoot);
    runAfterCommitHandlers();
    roots.set(container, newRoot);
    runCommitHandlers(newRoot, committedDeletions);
  }
  pendingContainers.clear();
}

export function flushPendingRenders(): void {
  if (!flushScheduled) return;
  flushRenders();
}
