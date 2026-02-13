import type { Hook } from "./types.js";
import { currentFiber, scheduleRender } from "./fiber.js";

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

export function useState<T>(initial: T): [T, (value: T | ((prev: T) => T)) => void] {
  const hook = getHook();
  const fiber = currentFiber!;

  // Initialize on first render
  if (hook.queue === undefined) {
    hook.state = initial;
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

  if (hook.state === undefined) {
    hook.state = { effect, deps, cleanup: undefined, pending: true };
  } else {
    if (depsChanged(hook.state.deps, deps)) {
      hook.state.effect = effect;
      hook.state.deps = deps;
      hook.state.pending = true;
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
  initialState: S,
): [S, (action: A) => void] {
  const [state, setState] = useState(initialState);
  const dispatch = (action: A) => {
    setState((prev) => reducer(prev, action));
  };
  return [state, dispatch];
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
