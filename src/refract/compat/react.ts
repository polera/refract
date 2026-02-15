import { createElement, Fragment } from "../createElement.js";
import { memo } from "../memo.js";
import { createContext } from "../features/context.js";
import {
  createRef,
} from "../features/hooks.js";
import type { Component, Props, VNode } from "../types.js";
import {
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
  ensureHookDispatcherRuntime,
  registerExternalReactModule,
  resolveDispatcher,
} from "./sharedInternals.js";

const REACT_ELEMENT_TYPE = Symbol.for("react.element");
type ElementChild = VNode | string | number | boolean | null | undefined | ElementChild[];

ensureHookDispatcherRuntime();

function normalizeChildren(children: unknown): unknown[] {
  if (children === undefined) return [];
  return Array.isArray(children) ? children : [children];
}

function parseChildrenArgs(children: unknown[]): unknown {
  if (children.length === 0) return undefined;
  if (children.length === 1) return children[0];
  return children;
}

export function forwardRef<T, P extends Record<string, unknown> = Record<string, unknown>>(
  render: (props: P, ref: { current: T | null } | ((value: T | null) => void) | null) => VNode,
): Component {
  const ForwardRefComponent: Component = (props: Props) => {
    const { ref, ...rest } = props as Props & { ref?: { current: T | null } | ((value: T | null) => void) | null };
    return render(rest as unknown as P, ref ?? null);
  };
  return ForwardRefComponent;
}

export function isValidElement(value: unknown): value is VNode {
  return !!value
    && typeof value === "object"
    && "type" in (value as Record<string, unknown>)
    && "props" in (value as Record<string, unknown>);
}

export function cloneElement(
  element: VNode,
  props?: Record<string, unknown> | null,
  ...children: unknown[]
): VNode {
  const mergedProps: Record<string, unknown> = {
    ...element.props,
    ...(props ?? {}),
  };

  if (children.length > 0) {
    mergedProps.children = normalizeChildren(parseChildrenArgs(children)) as VNode[];
  }

  if (props?.key !== undefined) {
    mergedProps.key = props.key;
  } else if (element.key != null) {
    mergedProps.key = element.key;
  }

  const nextChildren = normalizeChildren(mergedProps.children);
  delete mergedProps.children;

  return createElement(element.type, mergedProps, ...(nextChildren as ElementChild[]));
}

function childrenToArray(children: unknown): unknown[] {
  if (children === undefined || children === null) return [];
  if (!Array.isArray(children)) return [children];
  const out: unknown[] = [];
  const stack = [...children];
  while (stack.length > 0) {
    const child = stack.shift();
    if (Array.isArray(child)) {
      stack.unshift(...child);
      continue;
    }
    if (child === undefined || child === null || typeof child === "boolean") {
      continue;
    }
    out.push(child);
  }
  return out;
}

export const Children = {
  map<T>(children: unknown, fn: (child: unknown, index: number) => T): T[] {
    return childrenToArray(children).map(fn);
  },
  forEach(children: unknown, fn: (child: unknown, index: number) => void): void {
    childrenToArray(children).forEach(fn);
  },
  count(children: unknown): number {
    return childrenToArray(children).length;
  },
  toArray(children: unknown): unknown[] {
    return childrenToArray(children);
  },
  only(children: unknown): unknown {
    const array = childrenToArray(children);
    if (array.length !== 1) {
      throw new Error("React.Children.only expected to receive a single React element child.");
    }
    return array[0];
  },
};

export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void] {
  return resolveDispatcher().useState(initial);
}

export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void {
  return resolveDispatcher().useEffect(effect, deps);
}

export function useLayoutEffect(effect: () => void | (() => void), deps?: unknown[]): void {
  return resolveDispatcher().useLayoutEffect(effect, deps);
}

export function useInsertionEffect(effect: () => void | (() => void), deps?: unknown[]): void {
  return resolveDispatcher().useInsertionEffect(effect, deps);
}

export function useRef<T>(initial: T): { current: T } {
  return resolveDispatcher().useRef(initial);
}

export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  return resolveDispatcher().useMemo(factory, deps);
}

export function useCallback<T extends Function>(cb: T, deps: unknown[]): T {
  return resolveDispatcher().useCallback(cb, deps) as T;
}

export function useReducer<S, A, I = S>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init?: (arg: I) => S,
): [S, (action: A) => void] {
  if (init) {
    return resolveDispatcher().useReducer(reducer, initialArg, init) as [S, (action: A) => void];
  }
  return resolveDispatcher().useReducer(reducer, initialArg as unknown as S) as [S, (action: A) => void];
}

export function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  getServerSnapshot?: () => T,
): T {
  return resolveDispatcher().useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useImperativeHandle<T>(
  ref: { current: T | null } | ((value: T | null) => void) | null | undefined,
  create: () => T,
  deps?: unknown[],
): void {
  return resolveDispatcher().useImperativeHandle(ref, create, deps);
}

export function useDebugValue(value: unknown): void {
  return resolveDispatcher().useDebugValue(value);
}

export function useContext<T>(context: unknown): T {
  return resolveDispatcher().useContext(context as never) as T;
}

export function useId(): string {
  return resolveDispatcher().useId();
}

export function startTransition(callback: () => void): void {
  callback();
}

export function useTransition(): [boolean, (callback: () => void) => void] {
  return resolveDispatcher().useTransition();
}

export function useDeferredValue<T>(value: T, initialValue?: T): T {
  return resolveDispatcher().useDeferredValue(value, initialValue);
}

export { createElement, Fragment, createContext, memo };
export {
  createRef,
  registerExternalReactModule,
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
};

export const version = "19.0.0-refract-compat";

const ReactCompat = {
  Children,
  Fragment,
  createContext,
  createElement,
  cloneElement,
  createRef,
  forwardRef,
  isValidElement,
  memo,
  registerExternalReactModule,
  startTransition,
  useCallback,
  useContext,
  useDebugValue,
  useDeferredValue,
  useEffect,
  useId,
  useImperativeHandle,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  version,
  $$typeof: REACT_ELEMENT_TYPE,
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE,
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,
};

export default ReactCompat;
