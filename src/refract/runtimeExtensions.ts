import type { Fiber } from "./types.js";

type FiberCleanupHandler = (fiber: Fiber) => void;
type AfterCommitHandler = () => void;
type RenderErrorHandler = (fiber: Fiber, error: unknown) => boolean;
type CommitHandler = (rootFiber: Fiber, deletions: Fiber[]) => void;
type ComponentBailoutHandler = (fiber: Fiber) => boolean;

const fiberCleanupHandlers = new Set<FiberCleanupHandler>();
const afterCommitHandlers = new Set<AfterCommitHandler>();
const renderErrorHandlers = new Set<RenderErrorHandler>();
const commitHandlers = new Set<CommitHandler>();
const componentBailoutHandlers = new Set<ComponentBailoutHandler>();

function makeUnregister<T>(set: Set<T>, value: T): () => void {
  return () => {
    set.delete(value);
  };
}

export function registerFiberCleanupHandler(handler: FiberCleanupHandler): () => void {
  fiberCleanupHandlers.add(handler);
  return makeUnregister(fiberCleanupHandlers, handler);
}

export function registerAfterCommitHandler(handler: AfterCommitHandler): () => void {
  afterCommitHandlers.add(handler);
  return makeUnregister(afterCommitHandlers, handler);
}

export function registerRenderErrorHandler(handler: RenderErrorHandler): () => void {
  renderErrorHandlers.add(handler);
  return makeUnregister(renderErrorHandlers, handler);
}

export function registerCommitHandler(handler: CommitHandler): () => void {
  commitHandlers.add(handler);
  return makeUnregister(commitHandlers, handler);
}

export function registerComponentBailoutHandler(handler: ComponentBailoutHandler): () => void {
  componentBailoutHandlers.add(handler);
  return makeUnregister(componentBailoutHandlers, handler);
}

export function runFiberCleanupHandlers(fiber: Fiber): void {
  for (const handler of fiberCleanupHandlers) {
    handler(fiber);
  }
}

export function runAfterCommitHandlers(): void {
  for (const handler of afterCommitHandlers) {
    handler();
  }
}

export function tryHandleRenderError(fiber: Fiber, error: unknown): boolean {
  for (const handler of renderErrorHandlers) {
    if (handler(fiber, error)) {
      return true;
    }
  }
  return false;
}

export function runCommitHandlers(rootFiber: Fiber, deletions: Fiber[]): void {
  for (const handler of commitHandlers) {
    handler(rootFiber, deletions);
  }
}

export function shouldBailoutComponent(fiber: Fiber): boolean {
  for (const handler of componentBailoutHandlers) {
    if (handler(fiber)) {
      return true;
    }
  }
  return false;
}
