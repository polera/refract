import type { Fiber } from "./types.js";
import { reconcileChildren } from "./reconcile.js";
import {
  registerAfterCommitHandler,
  registerFiberCleanupHandler,
  registerRenderErrorHandler,
} from "./runtimeExtensions.js";

const fibersWithPendingEffects = new Set<Fiber>();

export function markPendingEffects(fiber: Fiber): void {
  fibersWithPendingEffects.add(fiber);
}

function cleanupFiberEffects(fiber: Fiber): void {
  fibersWithPendingEffects.delete(fiber);
  if (!fiber.hooks) return;

  for (const hook of fiber.hooks) {
    const state = hook.state as { cleanup?: () => void } | undefined;
    if (state?.cleanup) {
      state.cleanup();
      state.cleanup = undefined;
    }
  }
}

function runPendingEffects(): void {
  for (const fiber of fibersWithPendingEffects) {
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
  fibersWithPendingEffects.clear();
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
