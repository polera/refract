import type { Fiber } from "../types.js";
import { registerComponentBailoutHandler } from "../runtimeExtensions.js";
import { isMemoComponent, type MemoComponent } from "../memoMarker.js";

function memoBailoutHandler(fiber: Fiber): boolean {
  if (!isMemoComponent(fiber.type)) return false;
  if (!fiber.alternate) return false;

  const memoComp = fiber.type as MemoComponent;
  if (!memoComp._compare(fiber.alternate.props, fiber.props)) {
    return false;
  }

  // Reuse entire subtree when memo compare passes.
  fiber.child = fiber.alternate.child;
  fiber.hooks = fiber.alternate.hooks;

  let child = fiber.child;
  while (child) {
    child.parent = fiber;
    child = child.sibling;
  }
  return true;
}

registerComponentBailoutHandler(memoBailoutHandler);
