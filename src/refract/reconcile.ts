import type { VNode, Fiber } from "./types.js";
import { PLACEMENT, UPDATE, DELETION } from "./types.js";
import { pushDeletion } from "./fiber.js";

/** Reconcile a fiber's children against a new list of VNodes */
export function reconcileChildren(parentFiber: Fiber, children: VNode[]): void {
  let oldFiber = parentFiber.alternate?.child ?? null;
  let prevSibling: Fiber | null = null;
  let i = 0;

  while (i < children.length || oldFiber) {
    const child = i < children.length ? children[i] : null;
    let newFiber: Fiber | null = null;

    const sameType = oldFiber && child && oldFiber.type === child.type;

    if (sameType && oldFiber && child) {
      // Update: reuse the DOM node
      newFiber = {
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

    if (child && !sameType) {
      // Placement: new node
      newFiber = {
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

    if (oldFiber && !sameType) {
      // Deletion: old node removed
      oldFiber.flags = DELETION;
      pushDeletion(oldFiber);
    }

    // Advance old fiber
    if (oldFiber) {
      oldFiber = oldFiber.sibling;
    }

    // Link into fiber tree
    if (i === 0) {
      parentFiber.child = newFiber;
    } else if (prevSibling && newFiber) {
      prevSibling.sibling = newFiber;
    }

    if (newFiber) {
      prevSibling = newFiber;
    }
    i++;
  }
}
