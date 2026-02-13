import type { VNode, Fiber } from "./types.js";
import { PLACEMENT, UPDATE, DELETION } from "./types.js";
import { pushDeletion } from "./fiber.js";

function createFiber(
  child: VNode,
  parentFiber: Fiber,
  oldFiber: Fiber | null,
): Fiber {
  if (oldFiber && oldFiber.type === child.type) {
    return {
      type: oldFiber.type,
      props: child.props,
      key: child.key,
      dom: oldFiber.dom,
      parentDom: parentFiber.dom ?? parentFiber.parentDom,
      parent: parentFiber,
      child: null,
      sibling: null,
      hooks: oldFiber.hooks,
      alternate: oldFiber,
      flags: UPDATE,
    };
  }
  return {
    type: child.type,
    props: child.props,
    key: child.key,
    dom: null,
    parentDom: parentFiber.dom ?? parentFiber.parentDom,
    parent: parentFiber,
    child: null,
    sibling: null,
    hooks: null,
    alternate: null,
    flags: PLACEMENT,
  };
}

/** Reconcile a fiber's children against a new list of VNodes */
export function reconcileChildren(parentFiber: Fiber, children: VNode[]): void {
  const oldChildren = collectOldChildren(parentFiber);
  const hasKeys = children.some((c) => c.key != null);

  if (hasKeys) {
    reconcileKeyed(parentFiber, children, oldChildren);
  } else {
    reconcilePositional(parentFiber, children, oldChildren);
  }
}

function collectOldChildren(parentFiber: Fiber): Fiber[] {
  const result: Fiber[] = [];
  let f = parentFiber.alternate?.child ?? null;
  while (f) {
    result.push(f);
    f = f.sibling;
  }
  return result;
}

function reconcilePositional(
  parentFiber: Fiber,
  children: VNode[],
  oldChildren: Fiber[],
): void {
  let prevSibling: Fiber | null = null;
  const maxLen = Math.max(children.length, oldChildren.length);

  for (let i = 0; i < maxLen; i++) {
    const child = i < children.length ? children[i] : null;
    const oldFiber = i < oldChildren.length ? oldChildren[i] : null;

    let newFiber: Fiber | null = null;

    if (child) {
      newFiber = createFiber(child, parentFiber, oldFiber);
    }

    if (oldFiber && (!child || oldFiber.type !== child.type)) {
      oldFiber.flags = DELETION;
      pushDeletion(oldFiber);
    }

    if (i === 0) {
      parentFiber.child = newFiber;
    } else if (prevSibling && newFiber) {
      prevSibling.sibling = newFiber;
    }

    if (newFiber) prevSibling = newFiber;
  }
}

function reconcileKeyed(
  parentFiber: Fiber,
  children: VNode[],
  oldChildren: Fiber[],
): void {
  // Build map of keyed old fibers
  const keyMap = new Map<string | number, Fiber>();
  const unkeyedOld: Fiber[] = [];
  for (const f of oldChildren) {
    if (f.key != null) {
      keyMap.set(f.key, f);
    } else {
      unkeyedOld.push(f);
    }
  }

  let prevSibling: Fiber | null = null;
  let unkeyedIndex = 0;
  let lastPlacedIndex = 0;
  const usedOld = new Set<Fiber>();

  for (let i = 0; i < children.length; i++) {
    const child = children[i];
    let oldFiber: Fiber | null = null;

    if (child.key != null) {
      oldFiber = keyMap.get(child.key) ?? null;
    } else {
      // Match unkeyed by position
      while (unkeyedIndex < unkeyedOld.length) {
        const candidate = unkeyedOld[unkeyedIndex];
        unkeyedIndex++;
        if (candidate.type === child.type) {
          oldFiber = candidate;
          break;
        } else {
          candidate.flags = DELETION;
          pushDeletion(candidate);
        }
      }
    }

    const newFiber = createFiber(child, parentFiber, oldFiber);

    if (oldFiber) {
      usedOld.add(oldFiber);
      // Check if we need to move
      const oldIndex = oldChildren.indexOf(oldFiber);
      if (oldIndex < lastPlacedIndex) {
        newFiber.flags = PLACEMENT;
      } else {
        lastPlacedIndex = oldIndex;
      }
    }

    if (i === 0) {
      parentFiber.child = newFiber;
    } else if (prevSibling) {
      prevSibling.sibling = newFiber;
    }

    prevSibling = newFiber;
  }

  // Delete remaining old fibers that weren't matched
  for (const f of oldChildren) {
    if (!usedOld.has(f)) {
      f.flags = DELETION;
      pushDeletion(f);
    }
  }

  // Delete remaining unkeyed old fibers
  while (unkeyedIndex < unkeyedOld.length) {
    const f = unkeyedOld[unkeyedIndex++];
    if (!usedOld.has(f)) {
      f.flags = DELETION;
      pushDeletion(f);
    }
  }
}
