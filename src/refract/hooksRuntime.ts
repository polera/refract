import type { Fiber } from "./types.js";
import { reconcileChildren } from "./reconcile.js";
import {
  registerAfterCommitHandler,
  registerFiberCleanupHandler,
  registerRenderErrorHandler,
} from "./runtimeExtensions.js";

const fibersWithPendingEffects = new Set<Fiber>();
const fibersWithPendingLayoutEffects = new Set<Fiber>();
const fibersWithPendingInsertionEffects = new Set<Fiber>();

export function markPendingEffects(fiber: Fiber): void {
  fibersWithPendingEffects.add(fiber);
}

export function markPendingLayoutEffects(fiber: Fiber): void {
  fibersWithPendingLayoutEffects.add(fiber);
}

export function markPendingInsertionEffects(fiber: Fiber): void {
  fibersWithPendingInsertionEffects.add(fiber);
}

function cleanupFiberEffects(fiber: Fiber): void {
  fibersWithPendingEffects.delete(fiber);
  fibersWithPendingLayoutEffects.delete(fiber);
  fibersWithPendingInsertionEffects.delete(fiber);
  if (!fiber.hooks) return;

  for (const hook of fiber.hooks) {
    const state = hook.state as { cleanup?: () => void } | undefined;
    if (state?.cleanup) {
      state.cleanup();
      state.cleanup = undefined;
    }
  }
}

function runPendingEffectsFor(fibers: Set<Fiber>): void {
  for (const fiber of fibers) {
    if (!fiber.hooks) continue;

    for (const hook of fiber.hooks) {
      const state = hook.state as {
        effect?: () => void | (() => void);
        pending?: boolean;
        cleanup?: () => void;
      } | undefined;
      if (state?.pending && state.effect) {
        if (state.cleanup) state.cleanup();
        state.cleanup = state.effect() || undefined;
        state.pending = false;
      }
    }
  }
  fibers.clear();
}

function runPendingEffects(): void {
  // run in insertion -> layout -> passive order
  runPendingEffectsFor(fibersWithPendingInsertionEffects);
  runPendingEffectsFor(fibersWithPendingLayoutEffects);
  runPendingEffectsFor(fibersWithPendingEffects);
}

function handleErrorBoundary(fiber: Fiber, error: unknown): boolean {
  let current: Fiber | null = fiber.parent;
  while (current) {
    if (current._errorHandler) {
      current._errorHandler(error);
      reconcileChildren(fiber, []);
      return true;
    }
    current = current.parent;
  }
  return false;
}

registerFiberCleanupHandler(cleanupFiberEffects);
registerAfterCommitHandler(runPendingEffects);
registerRenderErrorHandler(handleErrorBoundary);
