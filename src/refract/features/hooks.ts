import type { Hook } from "../types.js";
import { currentFiber, scheduleRender } from "../coreRenderer.js";
import { markPendingEffects, markPendingInsertionEffects, markPendingLayoutEffects } from "../hooksRuntime.js";

function getHook(): Hook {
  const fiber = currentFiber!;
  const idx = fiber._hookIndex!;
  fiber._hookIndex = idx + 1;

  if (idx < fiber.hooks!.length) {
    return fiber.hooks![idx];
  }
  const hook: Hook = { state: undefined };
  fiber.hooks!.push(hook);
  return hook;
}

export function useState<T>(initial: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void] {
  const hook = getHook();
  const fiber = currentFiber!;

  // Initialize on first render
  if (hook.queue === undefined) {
    hook.state = typeof initial === "function"
      ? (initial as () => T)()
      : initial;
    hook.queue = [];
  }

  // Process queued updates
  for (const action of hook.queue as ((prev: T) => T)[]) {
    hook.state = action(hook.state as T);
  }
  hook.queue = [];

  const setState = (value: T | ((prev: T) => T)) => {
    const action = typeof value === "function"
      ? value as (prev: T) => T
      : () => value;
    (hook.queue as ((prev: T) => T)[]).push(action);
    scheduleRender(fiber);
  };

  return [hook.state as T, setState];
}

type EffectCleanup = void | (() => void);

interface EffectHook extends Hook {
  state: {
    effect: () => EffectCleanup;
    deps: unknown[] | undefined;
    cleanup?: EffectCleanup;
    pending: boolean;
  };
}

export function useEffect(effect: () => EffectCleanup, deps?: unknown[]): void {
  const hook = getHook() as EffectHook;
  const fiber = currentFiber!;

  if (hook.state === undefined) {
    hook.state = { effect, deps, cleanup: undefined, pending: true };
    markPendingEffects(fiber);
  } else {
    if (depsChanged(hook.state.deps, deps)) {
      hook.state.effect = effect;
      hook.state.deps = deps;
      hook.state.pending = true;
      markPendingEffects(fiber);
    } else {
      hook.state.pending = false;
    }
  }
}

export function useLayoutEffect(effect: () => EffectCleanup, deps?: unknown[]): void {
  const hook = getHook() as EffectHook;
  const fiber = currentFiber!;

  if (hook.state === undefined) {
    hook.state = { effect, deps, cleanup: undefined, pending: true };
    markPendingLayoutEffects(fiber);
  } else {
    if (depsChanged(hook.state.deps, deps)) {
      hook.state.effect = effect;
      hook.state.deps = deps;
      hook.state.pending = true;
      markPendingLayoutEffects(fiber);
    } else {
      hook.state.pending = false;
    }
  }
}

export function useInsertionEffect(effect: () => EffectCleanup, deps?: unknown[]): void {
  const hook = getHook() as EffectHook;
  const fiber = currentFiber!;

  if (hook.state === undefined) {
    hook.state = { effect, deps, cleanup: undefined, pending: true };
    markPendingInsertionEffects(fiber);
  } else {
    if (depsChanged(hook.state.deps, deps)) {
      hook.state.effect = effect;
      hook.state.deps = deps;
      hook.state.pending = true;
      markPendingInsertionEffects(fiber);
    } else {
      hook.state.pending = false;
    }
  }
}

interface RefHook extends Hook {
  state: { current: unknown };
}

export function useRef<T>(initial: T): { current: T } {
  const hook = getHook() as RefHook;

  if (hook.state === undefined) {
    hook.state = { current: initial };
  }

  return hook.state as { current: T };
}

export function useMemo<T>(factory: () => T, deps: unknown[]): T {
  const hook = getHook();

  if (hook.state === undefined) {
    hook.state = { value: factory(), deps };
  } else {
    const s = hook.state as { value: T; deps: unknown[] };
    if (depsChanged(s.deps, deps)) {
      s.value = factory();
      s.deps = deps;
    }
  }

  return (hook.state as { value: T }).value;
}

export function useCallback<T extends Function>(cb: T, deps: unknown[]): T {
  return useMemo(() => cb, deps);
}

export function useReducer<S, A>(
  reducer: (state: S, action: A) => S,
  initialArg: S,
): [S, (action: A) => void];

export function useReducer<S, A, I>(
  reducer: (state: S, action: A) => S,
  initialArg: I,
  init: (arg: I) => S,
): [S, (action: A) => void];

export function useReducer<S, A, I>(
  reducer: (state: S, action: A) => S,
  initialArg: S | I,
  init?: (arg: I) => S,
): [S, (action: A) => void] {
  const [state, setState] = useState<S>(() => (
    init
      ? init(initialArg as I)
      : initialArg as S
  ));
  const dispatch = (action: A) => {
    setState((prev) => reducer(prev, action));
  };
  return [state, dispatch];
}

export function createRef<T = unknown>(): { current: T | null } {
  return { current: null };
}

let idCounter = 0;

export function useId(): string {
  const hook = getHook();
  if (hook.state === undefined) {
    hook.state = `:r${idCounter++}:`;
  }
  return hook.state as string;
}

export function useImperativeHandle<T>(
  ref: { current: T | null } | ((value: T | null) => void) | null | undefined,
  create: () => T,
  deps?: unknown[],
): void {
  useLayoutEffect(() => {
    const value = create();
    if (typeof ref === "function") {
      ref(value);
      return () => ref(null);
    }
    if (ref && typeof ref === "object" && "current" in ref) {
      ref.current = value;
      return () => {
        ref.current = null;
      };
    }
    return;
  }, deps);
}

export function useDebugValue(_value: unknown): void {
  // no-op compatibility hook
}

export function startTransition(callback: () => void): void {
  callback();
}

export function useTransition(): [boolean, (callback: () => void) => void] {
  return [false, startTransition];
}

export function useDeferredValue<T>(value: T, _initialValue?: T): T {
  return value;
}

export function useSyncExternalStore<T>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => T,
  _getServerSnapshot?: () => T,
): T {
  const [snapshot, setSnapshot] = useState<T>(getSnapshot());

  useEffect(() => {
    const handleStoreChange = () => {
      setSnapshot(getSnapshot());
    };
    const unsubscribe = subscribe(handleStoreChange);
    handleStoreChange();
    return () => {
      unsubscribe();
    };
  }, [subscribe, getSnapshot]);

  return snapshot;
}

export function useErrorBoundary(): [
  unknown,
  () => void,
] {
  const [error, setError] = useState<unknown>(null);
  const fiber = currentFiber!;
  fiber._errorHandler = (err: unknown) => setError(err);
  const resetError = () => setError(null);
  return [error, resetError];
}

export function depsChanged(
  oldDeps: unknown[] | undefined,
  newDeps: unknown[] | undefined,
): boolean {
  if (!oldDeps || !newDeps) return true;
  if (oldDeps.length !== newDeps.length) return true;
  for (let i = 0; i < oldDeps.length; i++) {
    if (!Object.is(oldDeps[i], newDeps[i])) return true;
  }
  return false;
}
