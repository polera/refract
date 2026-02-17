import { createElement as createElementImpl, Fragment } from "../createElement.js";
import { memo } from "../memo.js";
import { createContext as createContextImpl } from "../features/context.js";
import {
  createRef,
  useErrorBoundary,
} from "../features/hooks.js";
import type { Component as RefractComponent, Props, VNode } from "../types.js";
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
): RefractComponent {
  const ForwardRefComponent: RefractComponent = (props: Props) => {
    const { ref, ...rest } = props as Props & { ref?: { current: T | null } | ((value: T | null) => void) | null };
    return render(rest as unknown as P, ref ?? null);
  };
  (ForwardRefComponent as any).displayName = `ForwardRef(${(render as any).name || 'anonymous'})`;
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

  const vnode = createElement(element.type, mergedProps, ...(nextChildren as ElementChild[]));
  // React compat: single child should not be wrapped in array
  const c = vnode.props.children;
  if (Array.isArray(c) && c.length === 1) {
    vnode.props.children = c[0];
  }
  return vnode;
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

// ---------------------------------------------------------------------------
// Context Wrapper
// ---------------------------------------------------------------------------

export function createContext<T>(defaultValue: T): any {
  const ctx = createContextImpl(defaultValue) as any;
  ctx._currentValue = defaultValue;
  ctx._currentValue2 = defaultValue;
  ctx.displayName = undefined;
  ctx.Consumer = ctx;
  if (ctx.Provider) {
    ctx.Provider._context = ctx;
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Class Component Support
// ---------------------------------------------------------------------------

export function Component(this: any, props: any, context?: any) {
  this.props = props;
  this.state = {};
  this.context = context ?? undefined;
  this._forceUpdate = null;
}
Component.prototype.setState = function (
  this: any,
  partial: any,
  callback?: () => void,
): void {
  if (typeof partial === 'function') {
    const result = partial(this.state, this.props);
    if (result != null) {
      this.state = { ...this.state, ...result };
    }
  } else {
    this.state = { ...this.state, ...partial };
  }
  if (this._forceUpdate) {
    this._forceUpdate();
  }
  if (callback) queueMicrotask(callback);
};
Component.prototype.forceUpdate = function (this: any, callback?: () => void): void {
  if (this._forceUpdate) {
    this._forceUpdate();
  }
  if (callback) queueMicrotask(callback);
};
Component.prototype.render = function (): unknown {
  return null;
};
Component.prototype.isReactComponent = {};

export function PureComponent(this: any, props: any) {
  Component.call(this, props);
}
PureComponent.prototype = Object.create(Component.prototype);
PureComponent.prototype.constructor = PureComponent;
PureComponent.prototype.isPureReactComponent = true;

// ---------------------------------------------------------------------------
// Suspense / Lazy
// ---------------------------------------------------------------------------

export function Suspense(props: { children?: unknown; fallback?: unknown }): unknown {
  return props.children ?? null;
}

export function lazy<T extends { default: (...args: any[]) => any }>(
  factory: () => Promise<T>,
): (props: any) => unknown {
  let resolved: ((...args: any[]) => any) | null = null;
  let promise: Promise<void> | null = null;
  const LazyComponent = (props: any) => {
    if (resolved) return createElementImpl(resolved as any, props);
    if (!promise) {
      promise = factory().then((mod) => {
        resolved = mod.default;
      });
    }
    throw promise;
  };
  return LazyComponent;
}

// ---------------------------------------------------------------------------
// Class Wrapper Logic
// ---------------------------------------------------------------------------

const classWrapperCache = new WeakMap<Function, Function>();

export function isClassComponent(type: unknown): boolean {
  return (
    typeof type === 'function' &&
    (type as any).prototype != null &&
    typeof (type as any).prototype.render === 'function'
  );
}

export function wrapClassComponent(ClassComp: Function): (props: any) => unknown {
  const cached = classWrapperCache.get(ClassComp);
  if (cached) return cached as (props: any) => unknown;

  const Ctor = ClassComp as any;
  const hasErrorBoundary = typeof Ctor.getDerivedStateFromError === 'function';
  const hasLifecycles =
    typeof Ctor.prototype.componentDidMount === 'function' ||
    typeof Ctor.prototype.componentDidUpdate === 'function';
  const hasWillUnmount = typeof Ctor.prototype.componentWillUnmount === 'function';
  const contextType = Ctor.contextType ?? null;

  const Wrapper = (rawProps: any): unknown => {
    const props = Ctor.defaultProps ? { ...Ctor.defaultProps, ...rawProps } : rawProps;
    const [, setTick] = useState(0);
    const forceUpdate = useCallback(() => setTick((t: number) => t + 1), []);
    const instanceRef = useRef<any>(null);

    if (!instanceRef.current) {
      instanceRef.current = new (ClassComp as any)(props);
    }
    const instance = instanceRef.current;
    instance.props = props;
    instance._forceUpdate = forceUpdate;

    if (contextType) {
      instance.context = useContext(contextType);
    }

    if (typeof Ctor.getDerivedStateFromProps === 'function') {
      const derived = Ctor.getDerivedStateFromProps(props, instance.state);
      if (derived != null) {
        instance.state = { ...instance.state, ...derived };
      }
    }

    if (hasErrorBoundary) {
      const [error, resetError] = useErrorBoundary();
      if (error) {
        const newState = Ctor.getDerivedStateFromError(error);
        instance.state = { ...instance.state, ...newState };
        if (typeof (instance as any).componentDidCatch === 'function') {
          (instance as any).componentDidCatch(error, { componentStack: '' });
        }
        resetError();
      }
    }

    if (hasLifecycles) {
      const mountedRef = useRef(false);
      const prevPropsRef = useRef<any>(null);
      const prevStateRef = useRef<any>(null);

      useLayoutEffect(() => {
        if (!mountedRef.current) {
          mountedRef.current = true;
          if (typeof instance.componentDidMount === 'function') {
            instance.componentDidMount();
          }
        } else {
          if (typeof instance.componentDidUpdate === 'function') {
            instance.componentDidUpdate(prevPropsRef.current, prevStateRef.current);
          }
        }
        prevPropsRef.current = instance.props;
        prevStateRef.current = { ...instance.state };
      });
    }

    if (hasWillUnmount) {
      useEffect(() => {
        return () => {
          instance.componentWillUnmount();
        };
      }, []);
    }

    return instance.render();
  };

  Object.defineProperty(Wrapper, 'name', {
    value: (ClassComp as any).displayName || ClassComp.name || 'ClassWrapper',
  });

  classWrapperCache.set(ClassComp, Wrapper);
  return Wrapper;
}

// ---------------------------------------------------------------------------
// Event Wrapping
// ---------------------------------------------------------------------------

export function createSyntheticEvent(nativeEvent: Event) {
  let isPropagationStopped = false;
  let isDefaultPrevented = false;

  const syntheticEvent = {
    nativeEvent,
    currentTarget: nativeEvent.currentTarget,
    target: nativeEvent.target,
    bubbles: nativeEvent.bubbles,
    cancelable: nativeEvent.cancelable,
    defaultPrevented: nativeEvent.defaultPrevented,
    eventPhase: nativeEvent.eventPhase,
    isTrusted: nativeEvent.isTrusted,
    preventDefault: () => {
      isDefaultPrevented = true;
      nativeEvent.preventDefault();
    },
    isDefaultPrevented: () => isDefaultPrevented,
    stopPropagation: () => {
      isPropagationStopped = true;
      nativeEvent.stopPropagation();
    },
    isPropagationStopped: () => isPropagationStopped,
    persist: () => {},
    timeStamp: nativeEvent.timeStamp,
    type: nativeEvent.type,
  };

  return new Proxy(syntheticEvent, {
    get: (target, prop) => {
      if (prop in target) return (target as any)[prop];
      const val = (nativeEvent as any)[prop];
      if (typeof val === 'function') return val.bind(nativeEvent);
      return val;
    }
  });
}

const wrappedHandlerCache = new WeakMap<Function, Function>();

export function getWrappedHandler(handler: Function) {
  if (wrappedHandlerCache.has(handler)) return wrappedHandlerCache.get(handler);

  const wrapped = (nativeEvent: Event) => {
    if ((nativeEvent as any).nativeEvent && typeof (nativeEvent as any).isPropagationStopped === 'function') {
      return handler(nativeEvent);
    }
    const synthetic = createSyntheticEvent(nativeEvent);
    return handler(synthetic);
  };
  wrappedHandlerCache.set(handler, wrapped);
  return wrapped;
}

function normalizeChildrenSingle(vnode: any): any {
  if (!vnode || !vnode.props) return vnode;
  const c = vnode.props.children;
  if (Array.isArray(c) && c.length === 1) {
    vnode.props.children = c[0];
  }
  return vnode;
}

export function createElement(type: unknown, props?: unknown, ...children: unknown[]): VNode {
  const effectiveType = isClassComponent(type) ? wrapClassComponent(type as Function) : type;

  if (typeof type === 'string' && props && typeof props === 'object') {
    const newProps = { ...props } as Record<string, unknown>;
    let hasChanges = false;
    for (const key in newProps) {
      if (key.startsWith('on') && typeof newProps[key] === 'function') {
         newProps[key] = getWrappedHandler(newProps[key] as Function);
         hasChanges = true;
      }
    }
    if (hasChanges) {
        return normalizeChildrenSingle(createElementImpl(effectiveType as any, newProps, ...(children as any[])));
    }
  }

  return normalizeChildrenSingle(createElementImpl(effectiveType as any, props as any, ...(children as any[])));
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export { Fragment, memo };
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
  Component,
  PureComponent,
  Suspense,
  lazy,
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