import type { Fiber } from "./types.js";
import { reconcileChildren } from "./reconcile.js";
import {
  registerAfterCommitHandler,
  registerBeforeRenderBatchHandler,
  registerFiberCleanupHandler,
  registerRenderErrorHandler,
} from "./runtimeExtensions.js";

const fibersWithPendingEffects = new Set<Fiber>();
const fibersWithPendingLayoutEffects = new Set<Fiber>();
const fibersWithPendingInsertionEffects = new Set<Fiber>();
const deferredPassiveEffectFibers = new Set<Fiber>();
let passiveFlushScheduled = false;

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
  deferredPassiveEffectFibers.delete(fiber);
  if (!fiber.hooks) return;

  for (const hook of fiber.hooks) {
    const state = hook.state;
    if (!state || typeof state !== "object") continue;
    const effectState = state as { cleanup?: () => void; pending?: boolean };
    if (effectState.cleanup) {
      effectState.cleanup();
      effectState.cleanup = undefined;
    }
    // Prevent deferred passive effects from running on unmounted fibers
    if ("pending" in effectState) {
      effectState.pending = false;
    }
  }
}

function runPendingEffectsFor(fibers: Set<Fiber>, effectType: string): void {
  for (const fiber of fibers) {
    if (!fiber.hooks) continue;

    for (const hook of fiber.hooks) {
      const state = hook.state as {
        effect?: () => void | (() => void);
        pending?: boolean;
        cleanup?: () => void;
        effectType?: string;
      } | undefined;
      if (state?.effectType !== effectType) continue;
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
  // Insertion and layout effects run synchronously (matching React)
  runPendingEffectsFor(fibersWithPendingInsertionEffects, "insertion");
  runPendingEffectsFor(fibersWithPendingLayoutEffects, "layout");

  // Passive effects (useEffect) are deferred until after the current
  // synchronous work completes, matching React's behavior.
  if (fibersWithPendingEffects.size > 0) {
    for (const fiber of fibersWithPendingEffects) {
      deferredPassiveEffectFibers.add(fiber);
    }
    fibersWithPendingEffects.clear();
    if (!passiveFlushScheduled) {
      passiveFlushScheduled = true;
      setTimeout(flushPassiveEffects, 0);
    }
  }
}

export function flushPassiveEffects(): void {
  passiveFlushScheduled = false;
  if (deferredPassiveEffectFibers.size === 0) return;
  const fibers = new Set(deferredPassiveEffectFibers);
  deferredPassiveEffectFibers.clear();
  runPendingEffectsFor(fibers, "passive");
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
registerBeforeRenderBatchHandler(flushPassiveEffects);
registerRenderErrorHandler(handleErrorBoundary);
