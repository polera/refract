import type { VNode, Fiber, Props, Hook } from "./types.js";
import { PLACEMENT, UPDATE, DELETION } from "./types.js";
import { reconcileChildren } from "./reconcile.js";
import { Fragment } from "./createElement.js";
import { reportDevtoolsCommit } from "./devtools.js";

/** Module globals for hook system */
export let currentFiber: Fiber | null = null;

/** Store root fiber per container */
const roots = new WeakMap<Node, Fiber>();
let deletions: Fiber[] = [];
const fibersWithPendingEffects = new Set<Fiber>();

const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set([
  "svg", "circle", "ellipse", "line", "path", "polygon", "polyline",
  "rect", "g", "defs", "use", "text", "tspan", "image", "clipPath",
  "mask", "pattern", "marker", "linearGradient", "radialGradient", "stop",
  "foreignObject", "symbol", "desc", "title",
]);
const URL_ATTRS = new Set(["href", "src", "action", "formaction", "xlink:href"]);
const BLOCKED_HTML_TAGS = new Set(["script", "iframe", "object", "embed", "link", "meta", "base"]);

export type HtmlSanitizer = (html: string) => string;

let htmlSanitizer: HtmlSanitizer = defaultHtmlSanitizer;

export function setHtmlSanitizer(sanitizer: HtmlSanitizer | null): void {
  htmlSanitizer = sanitizer ?? defaultHtmlSanitizer;
}

function normalizedUrl(value: string): string {
  return value.replace(/[\u0000-\u0020\u007f]+/g, "").toLowerCase();
}

function isUnsafeUrl(value: string): boolean {
  const normalized = normalizedUrl(value);
  return normalized.startsWith("javascript:") || normalized.startsWith("vbscript:");
}

function isUnsafeUrlProp(key: string, value: unknown): boolean {
  if (typeof value !== "string") return false;
  return URL_ATTRS.has(key.toLowerCase()) && isUnsafeUrl(value);
}

function defaultHtmlSanitizer(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;

  const elements = template.content.querySelectorAll("*");
  for (const element of elements) {
    const tagName = element.tagName.toLowerCase();
    if (BLOCKED_HTML_TAGS.has(tagName)) {
      element.remove();
      continue;
    }

    for (const attr of Array.from(element.attributes)) {
      const attrName = attr.name.toLowerCase();
      if (attrName.startsWith("on")) {
        element.removeAttribute(attr.name);
        continue;
      }

      if (URL_ATTRS.has(attrName) && isUnsafeUrl(attr.value)) {
        element.removeAttribute(attr.name);
      }
    }
  }

  return template.innerHTML;
}

export function pushDeletion(fiber: Fiber): void {
  deletions.push(fiber);
}

export function markPendingEffects(fiber: Fiber): void {
  fibersWithPendingEffects.add(fiber);
}

/** Create a real DOM node from a fiber */
export function createDom(fiber: Fiber): Node {
  if (fiber.type === "TEXT") {
    return document.createTextNode(fiber.props.nodeValue as string);
  }
  const tag = fiber.type as string;
  const isSvg = SVG_TAGS.has(tag) || isSvgContext(fiber);
  const el = isSvg
    ? document.createElementNS(SVG_NS, tag)
    : document.createElement(tag);
  applyProps(el as HTMLElement, {}, fiber.props);
  return el;
}

/** Check if a fiber is inside an SVG context */
function isSvgContext(fiber: Fiber): boolean {
  let f = fiber.parent;
  while (f) {
    if (f.type === "svg") return true;
    if (typeof f.type === "string" && f.type !== "svg" && f.dom) return false;
    f = f.parent;
  }
  return false;
}

/** Apply props to a DOM element, diffing against old props */
export function applyProps(
  el: HTMLElement,
  oldProps: Record<string, unknown>,
  newProps: Record<string, unknown>,
): void {
  for (const key of Object.keys(oldProps)) {
    if (key === "children" || key === "key" || key === "ref") continue;
    if (!(key in newProps)) {
      if (key.startsWith("on")) {
        el.removeEventListener(key.slice(2).toLowerCase(), oldProps[key] as EventListener);
      } else {
        el.removeAttribute(key);
      }
    }
  }

  for (const key of Object.keys(newProps)) {
    if (key === "children" || key === "key" || key === "ref") continue;
    if (oldProps[key] === newProps[key]) continue;

    if (key === "dangerouslySetInnerHTML") {
      const raw = (newProps[key] as { __html?: unknown } | undefined)?.__html;
      if (typeof raw !== "string") {
        throw new TypeError("dangerouslySetInnerHTML expects a string __html value");
      }
      el.innerHTML = htmlSanitizer(raw);
    } else if (key.startsWith("on")) {
      const event = key.slice(2).toLowerCase();
      if (oldProps[key]) {
        el.removeEventListener(event, oldProps[key] as EventListener);
      }
      el.addEventListener(event, newProps[key] as EventListener);
    } else if (key === "className") {
      el.setAttribute("class", newProps[key] as string);
    } else if (key === "style") {
      if (typeof newProps[key] === "object" && newProps[key] !== null) {
        const prevStyles = (typeof oldProps[key] === "object" && oldProps[key] !== null)
          ? oldProps[key] as Record<string, unknown>
          : {};
        const styles = newProps[key] as Record<string, unknown>;
        for (const prop of Object.keys(prevStyles)) {
          if (!(prop in styles)) {
            (el.style as unknown as Record<string, string>)[prop] = "";
          }
        }
        for (const [prop, val] of Object.entries(styles)) {
          (el.style as unknown as Record<string, string>)[prop] = val == null ? "" : String(val);
        }
      } else {
        el.removeAttribute("style");
      }
    } else {
      if (isUnsafeUrlProp(key, newProps[key])) {
        el.removeAttribute(key);
        continue;
      }
      el.setAttribute(key, String(newProps[key]));
    }
  }
}

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

/** Memo wrapper type marker */
const MEMO_MARKER = Symbol.for("refract.memo");

interface MemoComponent {
  (props: Props): VNode;
  _inner: (props: Props) => VNode;
  _compare: (a: Record<string, unknown>, b: Record<string, unknown>) => boolean;
  _memo: typeof MEMO_MARKER;
}

export function memo(
  component: (props: Props) => VNode,
  compare?: (a: Record<string, unknown>, b: Record<string, unknown>) => boolean,
): (props: Props) => VNode {
  const memoComp: MemoComponent = ((props: Props) => component(props)) as MemoComponent;
  memoComp._inner = component;
  memoComp._compare = compare ?? shallowEqual;
  memoComp._memo = MEMO_MARKER;
  return memoComp;
}

function isMemo(type: unknown): type is MemoComponent {
  return typeof type === "function" && (type as MemoComponent)._memo === MEMO_MARKER;
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
  runEffects();
  roots.set(container, rootFiber);
  reportDevtoolsCommit(rootFiber, committedDeletions);
}

/** Depth-first work loop: call components, diff children */
function performWork(fiber: Fiber): void {
  const isComponent = typeof fiber.type === "function";
  const isFragment = fiber.type === Fragment;

  if (isComponent) {
    // Memo bailout: skip re-render if props haven't changed
    if (isMemo(fiber.type) && fiber.alternate && fiber.flags === UPDATE) {
      const memoComp = fiber.type as MemoComponent;
      if (memoComp._compare(fiber.alternate.props, fiber.props)) {
        // Reuse entire subtree
        fiber.child = fiber.alternate.child;
        fiber.hooks = fiber.alternate.hooks;
        // Reparent children to new fiber
        let c = fiber.child;
        while (c) {
          c.parent = fiber;
          c = c.sibling;
        }
        return advanceWork(fiber);
      }
    }

    currentFiber = fiber;
    fiber._hookIndex = 0;
    if (!fiber.hooks) fiber.hooks = [];

    const comp = fiber.type as (props: Props) => VNode;
    try {
      const children = [comp(fiber.props)];
      reconcileChildren(fiber, children);
    } catch (error) {
      if (!handleError(fiber, error)) throw error;
    }
  } else if (isFragment) {
    reconcileChildren(fiber, fiber.props.children ?? []);
  } else {
    if (!fiber.dom) {
      fiber.dom = createDom(fiber);
    }
    // Skip children when dangerouslySetInnerHTML is used
    if (!fiber.props.dangerouslySetInnerHTML) {
      reconcileChildren(fiber, fiber.props.children ?? []);
    }
  }

  // Traverse: child first, then sibling, then uncle
  if (fiber.child) {
    performWork(fiber.child);
    return;
  }

  advanceWork(fiber);
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

/** Find the next DOM sibling for insertion (skips fragments/components and uncommitted nodes) */
function getNextDomSibling(fiber: Fiber): Node | null {
  let sib: Fiber | null = fiber.sibling;
  while (sib) {
    if (sib.dom && !(sib.flags & PLACEMENT)) return sib.dom;
    if (!sib.dom && sib.child) {
      const childDom = getFirstCommittedDom(sib);
      if (childDom) return childDom;
    }
    sib = sib.sibling;
  }
  return null;
}

/** Get the first committed DOM node in a fiber subtree */
function getFirstCommittedDom(fiber: Fiber): Node | null {
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
  let parentFiber = fiber.parent;
  while (parentFiber && !parentFiber.dom) {
    parentFiber = parentFiber.parent;
  }
  const parentDom = parentFiber!.dom!;

  if (fiber.flags & PLACEMENT && fiber.dom) {
    const before = getNextDomSibling(fiber);
    if (before) {
      parentDom.insertBefore(fiber.dom, before);
    } else {
      parentDom.appendChild(fiber.dom);
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
  if (fiber.dom) {
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
  fibersWithPendingEffects.delete(fiber);
  if (fiber.hooks) {
    for (const hook of fiber.hooks) {
      const s = hook.state as { cleanup?: () => void } | undefined;
      if (s?.cleanup) {
        s.cleanup();
        s.cleanup = undefined;
      }
    }
  }
  if (fiber.child) runCleanups(fiber.child);
  if (fiber.sibling) runCleanups(fiber.sibling);
}

function runEffects(): void {
  for (const fiber of fibersWithPendingEffects) {
    if (!fiber.hooks) continue;
    for (const hook of fiber.hooks) {
      const s = hook.state as {
        effect?: () => void | (() => void);
        pending?: boolean;
        cleanup?: () => void;
      } | undefined;
      if (s?.pending && s.effect) {
        if (s.cleanup) s.cleanup();
        s.cleanup = s.effect() || undefined;
        s.pending = false;
      }
    }
  }
  fibersWithPendingEffects.clear();
}

/** Walk up fiber tree to find an error handler. Returns true if handled. */
function handleError(fiber: Fiber, error: unknown): boolean {
  let f: Fiber | null = fiber.parent;
  while (f) {
    if (f._errorHandler) {
      f._errorHandler(error);
      // Render a null child for the errored component
      reconcileChildren(fiber, []);
      return true;
    }
    f = f.parent;
  }
  return false;
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
    runEffects();
    roots.set(container, newRoot);
    reportDevtoolsCommit(newRoot, committedDeletions);
  }
  pendingContainers.clear();
}
