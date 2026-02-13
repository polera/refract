import type { VNode, Props } from "./types.js";
import { currentFiber } from "./fiber.js";
import { createElement, Fragment } from "./createElement.js";

let contextId = 0;

export interface Context<T> {
  Provider: (props: Props) => VNode;
  _id: number;
  _defaultValue: T;
}

export function createContext<T>(defaultValue: T): Context<T> {
  const id = contextId++;

  const Provider = (props: Props) => {
    // Store the context value on the fiber during render
    const fiber = currentFiber!;
    if (!fiber._contexts) fiber._contexts = new Map();
    fiber._contexts.set(id, props.value);

    const children = props.children ?? [];
    return children.length === 1 ? children[0] : createElement(Fragment, null, ...children);
  };

  return { Provider, _id: id, _defaultValue: defaultValue };
}

export function useContext<T>(context: Context<T>): T {
  const fiber = currentFiber!;
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
