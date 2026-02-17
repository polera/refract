import { describe, it, expect, beforeEach, vi } from "vitest";
import { createElement } from "../src/refract/createElement.js";
import { render } from "../src/refract/render.js";
import { useState, useEffect, useRef, useMemo, useCallback, useReducer } from "../src/refract/hooks.js";
import { flushPassiveEffects } from "../src/refract/hooksRuntime.js";

describe("hooks", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
  });

  describe("useState", () => {
    it("renders initial state", () => {
      function Counter() {
        const [count] = useState(0);
        return createElement("span", null, String(count));
      }
      render(createElement(Counter, null), container);
      expect(container.querySelector("span")!.textContent).toBe("0");
    });

    it("updates state on setState", async () => {
      let setCount!: (v: number | ((p: number) => number)) => void;
      function Counter() {
        const [count, sc] = useState(0);
        setCount = sc;
        return createElement("span", null, String(count));
      }
      render(createElement(Counter, null), container);
      expect(container.querySelector("span")!.textContent).toBe("0");

      setCount(1);
      await new Promise((r) => setTimeout(r, 10));
      expect(container.querySelector("span")!.textContent).toBe("1");
    });

    it("supports functional updates", async () => {
      let setCount!: (v: number | ((p: number) => number)) => void;
      function Counter() {
        const [count, sc] = useState(0);
        setCount = sc;
        return createElement("span", null, String(count));
      }
      render(createElement(Counter, null), container);

      setCount((prev) => prev + 1);
      setCount((prev) => prev + 1);
      await new Promise((r) => setTimeout(r, 10));
      expect(container.querySelector("span")!.textContent).toBe("2");
    });

    it("batches multiple setState calls", async () => {
      let renderCount = 0;
      let setCount!: (v: number | ((p: number) => number)) => void;
      function Counter() {
        const [count, sc] = useState(0);
        setCount = sc;
        renderCount++;
        return createElement("span", null, String(count));
      }
      render(createElement(Counter, null), container);
      expect(renderCount).toBe(1);

      setCount((p) => p + 1);
      setCount((p) => p + 1);
      setCount((p) => p + 1);
      await new Promise((r) => setTimeout(r, 10));
      // Should have batched into one re-render
      expect(renderCount).toBe(2);
      expect(container.querySelector("span")!.textContent).toBe("3");
    });
  });

  describe("useEffect", () => {
    it("runs effect after render (deferred)", async () => {
      const effectFn = vi.fn();
      function App() {
        useEffect(effectFn);
        return createElement("div", null);
      }
      render(createElement(App, null), container);
      // Passive effects are deferred (like React)
      expect(effectFn).not.toHaveBeenCalled();
      await new Promise((r) => setTimeout(r, 10));
      expect(effectFn).toHaveBeenCalledTimes(1);
    });

    it("can be flushed synchronously with flushPassiveEffects", () => {
      const effectFn = vi.fn();
      function App() {
        useEffect(effectFn);
        return createElement("div", null);
      }
      render(createElement(App, null), container);
      expect(effectFn).not.toHaveBeenCalled();
      flushPassiveEffects();
      expect(effectFn).toHaveBeenCalledTimes(1);
    });

    it("runs cleanup on re-render when deps change", async () => {
      const cleanup = vi.fn();
      let setValue!: (v: number) => void;
      function App() {
        const [value, sv] = useState(0);
        setValue = sv;
        useEffect(() => {
          return cleanup;
        }, [value]);
        return createElement("span", null, String(value));
      }
      render(createElement(App, null), container);
      expect(cleanup).not.toHaveBeenCalled();

      setValue(1);
      await new Promise((r) => setTimeout(r, 10));
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("skips effect when deps unchanged", async () => {
      const effectFn = vi.fn();
      let setValue!: (v: number) => void;
      function App() {
        const [value, sv] = useState(0);
        setValue = sv;
        useEffect(effectFn, []);
        return createElement("span", null, String(value));
      }
      render(createElement(App, null), container);
      // Flush initial passive effects
      flushPassiveEffects();
      expect(effectFn).toHaveBeenCalledTimes(1);

      setValue(1);
      await new Promise((r) => setTimeout(r, 10));
      // Effect should NOT run again because deps [] didn't change
      expect(effectFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("useRef", () => {
    it("returns stable ref object", async () => {
      const refs: { current: number }[] = [];
      let setValue!: (v: number) => void;
      function App() {
        const [value, sv] = useState(0);
        setValue = sv;
        const ref = useRef(42);
        refs.push(ref);
        return createElement("span", null, String(value));
      }
      render(createElement(App, null), container);

      setValue(1);
      await new Promise((r) => setTimeout(r, 10));

      expect(refs).toHaveLength(2);
      expect(refs[0]).toBe(refs[1]); // Same object
      expect(refs[0].current).toBe(42);
    });

    it("persists mutations across re-renders", async () => {
      let setValue!: (v: number) => void;
      let ref!: { current: number };
      function App() {
        const [value, sv] = useState(0);
        setValue = sv;
        ref = useRef(0);
        ref.current = value;
        return createElement("span", null, String(ref.current));
      }
      render(createElement(App, null), container);
      expect(ref.current).toBe(0);

      setValue(5);
      await new Promise((r) => setTimeout(r, 10));
      expect(ref.current).toBe(5);
    });
  });

  describe("useMemo", () => {
    it("memoizes value based on deps", async () => {
      let computeCount = 0;
      let setValue!: (v: number) => void;
      function App() {
        const [value, sv] = useState(0);
        setValue = sv;
        const memoized = useMemo(() => {
          computeCount++;
          return value * 2;
        }, [value]);
        return createElement("span", null, String(memoized));
      }
      render(createElement(App, null), container);
      expect(computeCount).toBe(1);
      expect(container.querySelector("span")!.textContent).toBe("0");

      setValue(5);
      await new Promise((r) => setTimeout(r, 10));
      expect(computeCount).toBe(2);
      expect(container.querySelector("span")!.textContent).toBe("10");
    });

    it("skips recomputation when deps unchanged", async () => {
      let computeCount = 0;
      let setOther!: (v: number) => void;
      function App() {
        const [other, so] = useState(0);
        setOther = so;
        const memoized = useMemo(() => {
          computeCount++;
          return "fixed";
        }, []);
        return createElement("span", null, `${memoized}-${other}`);
      }
      render(createElement(App, null), container);
      expect(computeCount).toBe(1);

      setOther(1);
      await new Promise((r) => setTimeout(r, 10));
      expect(computeCount).toBe(1); // Not recomputed
    });
  });

  describe("useCallback", () => {
    it("returns stable callback when deps unchanged", async () => {
      const callbacks: (() => void)[] = [];
      let setValue!: (v: number) => void;
      function App() {
        const [value, sv] = useState(0);
        setValue = sv;
        const cb = useCallback(() => {}, []);
        callbacks.push(cb);
        return createElement("span", null, String(value));
      }
      render(createElement(App, null), container);

      setValue(1);
      await new Promise((r) => setTimeout(r, 10));

      expect(callbacks[0]).toBe(callbacks[1]);
    });
  });

  describe("useReducer", () => {
    it("dispatches actions through reducer", async () => {
      type Action = { type: "inc" } | { type: "dec" };
      let dispatch!: (action: Action) => void;
      function Counter() {
        const [count, d] = useReducer((state: number, action: Action) => {
          if (action.type === "inc") return state + 1;
          if (action.type === "dec") return state - 1;
          return state;
        }, 0);
        dispatch = d;
        return createElement("span", null, String(count));
      }
      render(createElement(Counter, null), container);
      expect(container.querySelector("span")!.textContent).toBe("0");

      dispatch({ type: "inc" });
      dispatch({ type: "inc" });
      dispatch({ type: "inc" });
      await new Promise((r) => setTimeout(r, 10));
      expect(container.querySelector("span")!.textContent).toBe("3");

      dispatch({ type: "dec" });
      await new Promise((r) => setTimeout(r, 10));
      expect(container.querySelector("span")!.textContent).toBe("2");
    });
  });
});
