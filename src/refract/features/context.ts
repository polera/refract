import type { VNode, Props } from "../types.js";
import { currentFiber } from "../coreRenderer.js";
import { createElement, Fragment } from "../createElement.js";

let contextId = 0;

export interface Context<T> {
  Provider: (props: Props) => VNode;
  _id: number;
  _defaultValue: T;
}

export function setContextValue(context: unknown, value: unknown): void {
  const fiber = currentFiber!;
  if (typeof context === "object" && context !== null) {
    const maybeId = (context as { _id?: unknown })._id;
    if (typeof maybeId === "number") {
      if (!fiber._contexts) fiber._contexts = new Map();
      fiber._contexts.set(maybeId, value);
      return;
    }

    if (!fiber._objectContexts) fiber._objectContexts = new Map();
    fiber._objectContexts.set(context, value);
  }
}

export function createContext<T>(defaultValue: T): Context<T> {
  const id = contextId++;

  const Provider = (props: Props) => {
    // Store the context value on the fiber during render
    setContextValue({ _id: id }, props.value);

    const children = props.children ?? [];
    if (Array.isArray(children)) {
      return children.length === 1 ? children[0] : createElement(Fragment, null, ...children);
    }
    // Single child (React compat: children may be a VNode, not an array)
    return children;
  };

  return { Provider, _id: id, _defaultValue: defaultValue };
}

export function useContext<T>(context: Context<T>): T {
  const fiber = currentFiber!;
  if (typeof context === "object" && context !== null && !("_id" in context)) {
    let f = fiber.parent;
    while (f) {
      if (f._objectContexts?.has(context as unknown as object)) {
        return f._objectContexts.get(context as unknown as object) as T;
      }
      f = f.parent;
    }

    if ("_currentValue" in (context as unknown as Record<string, unknown>)) {
      return (context as unknown as { _currentValue: T })._currentValue;
    }
    return undefined as T;
  }

  // Walk up the fiber tree to find the nearest Provider
  let f = fiber.parent;
  while (f) {
    if (f._contexts?.has(context._id)) {
      return f._contexts.get(context._id) as T;
    }
    f = f.parent;
  }
  return context._defaultValue;
}
