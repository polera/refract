import type { Fiber, Props } from "./types.js";
import { registerCommitHandler } from "./runtimeExtensions.js";

export const DEVTOOLS_GLOBAL_HOOK = "__REFRACT_DEVTOOLS_GLOBAL_HOOK__";

export interface RefractDevtoolsRenderer {
  name: "refract";
}

export interface RefractDevtoolsFiberSnapshot {
  id: number;
  type: string;
  key: string | number | null;
  dom: string | null;
  props: Record<string, unknown>;
  hookState: unknown[];
  children: RefractDevtoolsFiberSnapshot[];
}

export interface RefractDevtoolsRootSnapshot {
  id: number;
  container: string;
  current: RefractDevtoolsFiberSnapshot | null;
}

export interface RefractDevtoolsHook {
  inject?: (renderer: RefractDevtoolsRenderer) => number;
  onCommitFiberRoot?: (rendererId: number, root: RefractDevtoolsRootSnapshot) => void;
  onCommitFiberUnmount?: (rendererId: number, fiber: RefractDevtoolsFiberSnapshot) => void;
}

let explicitHook: RefractDevtoolsHook | null | undefined = undefined;
let activeHook: RefractDevtoolsHook | null = null;
let activeRendererId = 1;

const containerIds = new WeakMap<Node, number>();
let nextContainerId = 1;

const fiberIds = new WeakMap<Fiber, number>();
let nextFiberId = 1;

export function setDevtoolsHook(hook?: RefractDevtoolsHook | null): void {
  explicitHook = hook;
  activeHook = null;
  activeRendererId = 1;
}

export function reportDevtoolsCommit(rootFiber: Fiber, deletions: Fiber[]): void {
  const hook = resolveHook();
  if (!hook) {
    activeHook = null;
    activeRendererId = 1;
    return;
  }

  const rendererId = ensureRenderer(hook);

  if (typeof hook.onCommitFiberRoot === "function") {
    safeCall(() => hook.onCommitFiberRoot!(rendererId, snapshotRoot(rootFiber)));
  }

  if (typeof hook.onCommitFiberUnmount === "function") {
    for (const deleted of deletions) {
      walkFiberSubtree(deleted, (fiber) => {
        safeCall(() => hook.onCommitFiberUnmount!(rendererId, snapshotFiber(fiber)));
      });
    }
  }
}

registerCommitHandler(reportDevtoolsCommit);

function resolveHook(): RefractDevtoolsHook | null {
  if (explicitHook !== undefined) return explicitHook;

  const candidate = (globalThis as Record<string, unknown>)[DEVTOOLS_GLOBAL_HOOK];
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as RefractDevtoolsHook;
}

function ensureRenderer(hook: RefractDevtoolsHook): number {
  if (hook === activeHook) return activeRendererId;

  activeHook = hook;
  activeRendererId = 1;

  if (typeof hook.inject === "function") {
    safeCall(() => {
      const id = hook.inject!({ name: "refract" });
      if (typeof id === "number" && Number.isFinite(id)) {
        activeRendererId = id;
      }
    });
  }

  return activeRendererId;
}

function snapshotRoot(rootFiber: Fiber): RefractDevtoolsRootSnapshot {
  const containerNode = rootFiber.dom ?? rootFiber.parentDom;
  return {
    id: getContainerId(containerNode),
    container: describeNode(containerNode) ?? "unknown",
    current: rootFiber.child ? snapshotFiber(rootFiber.child) : null,
  };
}

function snapshotFiber(fiber: Fiber): RefractDevtoolsFiberSnapshot {
  const children: RefractDevtoolsFiberSnapshot[] = [];
  let child = fiber.child;
  while (child) {
    children.push(snapshotFiber(child));
    child = child.sibling;
  }

  return {
    id: getFiberId(fiber),
    type: describeFiberType(fiber),
    key: fiber.key,
    dom: describeNode(fiber.dom),
    props: snapshotProps(fiber.props),
    hookState: snapshotHookState(fiber),
    children,
  };
}

function snapshotHookState(fiber: Fiber): unknown[] {
  if (!fiber.hooks || fiber.hooks.length === 0) return [];
  return fiber.hooks.map((hook) => serializeValue(hook.state, new WeakSet<object>(), 0));
}

function snapshotProps(props: Props): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = Object.keys(props).filter((key) => key !== "children");

  for (const key of keys.slice(0, 20)) {
    out[key] = serializeValue(props[key], new WeakSet<object>(), 0);
  }
  if (keys.length > 20) {
    out.__truncated = `${keys.length - 20} more keys`;
  }
  return out;
}

function serializeValue(value: unknown, seen: WeakSet<object>, depth: number): unknown {
  if (value == null) return value;

  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
      return value;
    case "bigint":
    case "symbol":
      return String(value);
    case "function": {
      const name = value.name || "anonymous";
      return `[function ${name}]`;
    }
    case "object": {
      if (typeof Node !== "undefined" && value instanceof Node) {
        return `[node ${describeNode(value) ?? value.nodeName.toLowerCase()}]`;
      }
      if (depth >= 2) {
        return Array.isArray(value) ? "[array]" : "[object]";
      }
      if (value instanceof Date) return value.toISOString();
      if (value instanceof RegExp) return String(value);

      if (seen.has(value)) return "[circular]";
      seen.add(value);

      if (Array.isArray(value)) {
        const items = value.slice(0, 10).map((item) => serializeValue(item, seen, depth + 1));
        if (value.length > 10) {
          items.push(`[+${value.length - 10} more items]`);
        }
        return items;
      }

      const record = value as Record<string, unknown>;
      const entries = Object.entries(record);
      const out: Record<string, unknown> = {};
      for (const [key, entryValue] of entries.slice(0, 10)) {
        out[key] = serializeValue(entryValue, seen, depth + 1);
      }
      if (entries.length > 10) {
        out.__truncated = `${entries.length - 10} more keys`;
      }
      return out;
    }
    default:
      return String(value);
  }
}

function describeFiberType(fiber: Fiber): string {
  if (fiber.type === "TEXT") return "#text";
  if (typeof fiber.type === "string") return fiber.type;
  if (typeof fiber.type === "symbol") return fiber.type.description ?? "Symbol";
  if (typeof fiber.type === "function") return fiber.type.name || "Anonymous";
  return "Unknown";
}

function describeNode(node: Node | null): string | null {
  if (!node) return null;

  if (typeof Element !== "undefined" && node instanceof Element) {
    const tag = node.tagName.toLowerCase();
    return node.id ? `${tag}#${node.id}` : tag;
  }
  if (node.nodeType === Node.TEXT_NODE) return "#text";
  return node.nodeName.toLowerCase();
}

function getContainerId(container: Node): number {
  const existing = containerIds.get(container);
  if (existing !== undefined) return existing;
  const id = nextContainerId++;
  containerIds.set(container, id);
  return id;
}

function getFiberId(fiber: Fiber): number {
  const existing = fiberIds.get(fiber);
  if (existing !== undefined) return existing;

  const alternateId = fiber.alternate ? fiberIds.get(fiber.alternate) : undefined;
  if (alternateId !== undefined) {
    fiberIds.set(fiber, alternateId);
    return alternateId;
  }

  const id = nextFiberId++;
  fiberIds.set(fiber, id);
  return id;
}

function walkFiberSubtree(fiber: Fiber, visit: (f: Fiber) => void): void {
  visit(fiber);
  let child = fiber.child;
  while (child) {
    walkFiberSubtree(child, visit);
    child = child.sibling;
  }
}

function safeCall(fn: () => void): void {
  try {
    fn();
  } catch {
    // Devtools hooks are optional and should never break app rendering.
  }
}
