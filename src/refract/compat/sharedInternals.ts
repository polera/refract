import {
  useCallback as rawUseCallback,
  useDebugValue as rawUseDebugValue,
  useDeferredValue as rawUseDeferredValue,
  useEffect as rawUseEffect,
  useId as rawUseId,
  useImperativeHandle as rawUseImperativeHandle,
  useInsertionEffect as rawUseInsertionEffect,
  useLayoutEffect as rawUseLayoutEffect,
  useMemo as rawUseMemo,
  useReducer as rawUseReducer,
  useRef as rawUseRef,
  useState as rawUseState,
  useSyncExternalStore as rawUseSyncExternalStore,
  useTransition as rawUseTransition,
} from "../features/hooks.js";
import { useContext as rawUseContext } from "../features/context.js";
import {
  registerAfterComponentRenderHandler,
  registerBeforeComponentRenderHandler,
} from "../runtimeExtensions.js";

const INVALID_HOOK_CALL_MESSAGE = [
  "Invalid hook call. Hooks can only be called inside of the body of a function component.",
  "This could happen for one of the following reasons:",
  "1. You might have mismatching versions of React and the renderer (such as React DOM)",
  "2. You might be breaking the Rules of Hooks",
  "3. You might have more than one copy of React in the same app",
  "See https://react.dev/link/invalid-hook-call for tips about how to debug and fix this problem.",
].join("\n");

export interface ReactCurrentDispatcherCompat {
  current: RefractHookDispatcher | null;
}

export interface ReactSecretInternalsCompat {
  ReactCurrentDispatcher: ReactCurrentDispatcherCompat;
}

export interface ReactClientInternalsCompat {
  H: RefractHookDispatcher | null;
  [key: string]: unknown;
}

type ExternalReactLike = {
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE?: unknown;
  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED?: unknown;
};

export interface RefractHookDispatcher {
  useState: typeof rawUseState;
  useReducer: typeof rawUseReducer;
  useRef: typeof rawUseRef;
  useEffect: typeof rawUseEffect;
  useLayoutEffect: typeof rawUseLayoutEffect;
  useInsertionEffect: typeof rawUseInsertionEffect;
  useMemo: typeof rawUseMemo;
  useCallback: typeof rawUseCallback;
  useContext: typeof rawUseContext;
  useId: typeof rawUseId;
  useSyncExternalStore: typeof rawUseSyncExternalStore;
  useTransition: typeof rawUseTransition;
  useDeferredValue: typeof rawUseDeferredValue;
  useImperativeHandle: typeof rawUseImperativeHandle;
  useDebugValue: typeof rawUseDebugValue;
}

const dispatcher: RefractHookDispatcher = {
  useState: rawUseState,
  useReducer: rawUseReducer,
  useRef: rawUseRef,
  useEffect: rawUseEffect,
  useLayoutEffect: rawUseLayoutEffect,
  useInsertionEffect: rawUseInsertionEffect,
  useMemo: rawUseMemo,
  useCallback: rawUseCallback,
  useContext: rawUseContext,
  useId: rawUseId,
  useSyncExternalStore: rawUseSyncExternalStore,
  useTransition: rawUseTransition,
  useDeferredValue: rawUseDeferredValue,
  useImperativeHandle: rawUseImperativeHandle,
  useDebugValue: rawUseDebugValue,
};

const clientInternals: ReactClientInternalsCompat = {
  H: null,
  A: null,
  T: null,
  S: null,
  actQueue: null,
  asyncTransitions: 0,
  isBatchingLegacy: false,
  didScheduleLegacyUpdate: false,
  didUsePromise: false,
  thrownErrors: [],
  getCurrentStack: null,
  recentlyCreatedOwnerStacks: 0,
};

const secretInternals: ReactSecretInternalsCompat = {
  ReactCurrentDispatcher: {
    current: null,
  },
};

const externalClientInternals = new Set<ReactClientInternalsCompat>();
const externalSecretInternals = new Set<ReactSecretInternalsCompat>();
const dispatcherStack: (RefractHookDispatcher | null)[] = [];

let runtimeInitialized = false;

export const __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE = clientInternals;
export const __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED = secretInternals;

export function resolveDispatcher(): RefractHookDispatcher {
  const active = clientInternals.H ?? secretInternals.ReactCurrentDispatcher.current;
  if (active == null) {
    throw new Error(INVALID_HOOK_CALL_MESSAGE);
  }
  return active;
}

export function ensureHookDispatcherRuntime(): void {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  registerBeforeComponentRenderHandler(beforeComponentRender);
  registerAfterComponentRenderHandler(afterComponentRender);
  tryAutoRegisterExternalReact();
}

export function registerExternalReactModule(moduleValue: unknown): void {
  if (!moduleValue || typeof moduleValue !== "object") return;
  const moduleRecord = moduleValue as ExternalReactLike;

  const candidateClient = moduleRecord.__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE;
  if (candidateClient && typeof candidateClient === "object" && "H" in (candidateClient as Record<string, unknown>)) {
    externalClientInternals.add(candidateClient as ReactClientInternalsCompat);
  }

  const candidateSecret = moduleRecord.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED;
  const dispatcherHolder = candidateSecret as { ReactCurrentDispatcher?: unknown } | undefined;
  if (
    dispatcherHolder
    && typeof dispatcherHolder === "object"
    && dispatcherHolder.ReactCurrentDispatcher
    && typeof dispatcherHolder.ReactCurrentDispatcher === "object"
    && "current" in (dispatcherHolder.ReactCurrentDispatcher as Record<string, unknown>)
  ) {
    externalSecretInternals.add(candidateSecret as ReactSecretInternalsCompat);
  }

  syncDispatcherToExternal();
}

function beforeComponentRender(): void {
  dispatcherStack.push(clientInternals.H);
  setDispatcher(dispatcher);
}

function afterComponentRender(): void {
  const previous = dispatcherStack.pop() ?? null;
  setDispatcher(previous);
}

function setDispatcher(value: RefractHookDispatcher | null): void {
  clientInternals.H = value;
  secretInternals.ReactCurrentDispatcher.current = value;
  syncDispatcherToExternal();
}

function syncDispatcherToExternal(): void {
  for (const ext of externalClientInternals) {
    ext.H = clientInternals.H;
  }
  for (const ext of externalSecretInternals) {
    ext.ReactCurrentDispatcher.current = clientInternals.H;
  }
}

function tryAutoRegisterExternalReact(): void {
  const maybeRequire = getNodeRequire();
  if (!maybeRequire) return;
  try {
    registerExternalReactModule(maybeRequire("react"));
  } catch {
    // External React module is optional.
  }
}

function getNodeRequire(): ((id: string) => unknown) | null {
  const globalRecord = globalThis as Record<string, unknown>;
  const candidateRequire = globalRecord.require;
  if (typeof candidateRequire === "function") {
    return candidateRequire as (id: string) => unknown;
  }

  const nodeProcess = globalRecord.process as { mainModule?: { require?: (id: string) => unknown } } | undefined;
  const mainModuleRequire = nodeProcess?.mainModule?.require;
  if (typeof mainModuleRequire === "function") {
    return mainModuleRequire.bind(nodeProcess?.mainModule);
  }

  try {
    const dynamicRequire = Function("return typeof require === 'function' ? require : null")() as
      | ((id: string) => unknown)
      | null;
    return dynamicRequire;
  } catch {
    return null;
  }
}
