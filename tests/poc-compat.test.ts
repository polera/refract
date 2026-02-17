
import { describe, test, expect, vi } from "vitest";
import { render } from "../src/refract/render.js";
import { createElement } from "../src/refract/createElement.js";
import { useSyncExternalStore, useState } from "../src/refract/compat/react.js";
import { setReactCompatEventMode } from "../src/refract/dom.js";

// Enable compat mode
setReactCompatEventMode(true);

describe("POC Compatibility", () => {
  test("useSyncExternalStore basic subscription", async () => {
    let listeners: (() => void)[] = [];
    const store = {
      value: 0,
      subscribe(l: () => void) {
        listeners.push(l);
        return () => {
          listeners = listeners.filter(x => x !== l);
        };
      },
      getSnapshot() {
        return store.value;
      },
      increment() {
        store.value++;
        listeners.forEach(l => l());
      }
    };

    function StoreComponent() {
      const val = useSyncExternalStore(store.subscribe, store.getSnapshot);
      return createElement("div", {}, `Value: ${val}`);
    }

    const container = document.createElement("div");
    render(createElement(StoreComponent, null), container);

    expect(container.textContent).toBe("Value: 0");

    store.increment();
    // Wait for microtasks/updates
    await new Promise(r => setTimeout(r, 0));
    
    expect(container.textContent).toBe("Value: 1");
  });

  test("onChange maps to input for text inputs", async () => {
    const handleChange = vi.fn();

    function InputComponent() {
      return createElement("input", { type: "text", onChange: handleChange });
    }

    const container = document.createElement("div");
    render(createElement(InputComponent, null), container);

    const input = container.querySelector("input");
    expect(input).not.toBeNull();

    // Simulate input event (which React treats as change)
    const event = new Event("input", { bubbles: true });
    input?.dispatchEvent(event);

    // In standard DOM, onChange doesn't fire on input, but React compat should handle this?
    // If not implemented, this will fail, confirming the need for the fix.
    expect(handleChange).toHaveBeenCalled();
  });
});
