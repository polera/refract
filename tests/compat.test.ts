import { beforeEach, describe, expect, it } from "vitest";
import * as ReactCompat from "../src/refract/compat/react.js";
import { createPortal, flushSync, unstable_batchedUpdates } from "../src/refract/compat/react-dom.js";
import { createRoot } from "../src/refract/compat/react-dom-client.js";
import { Fragment, jsx, jsxs } from "../src/refract/compat/react-jsx-runtime.js";

function waitForRender(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("react compat", () => {
  let container: HTMLDivElement;
  let portalContainer: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    portalContainer = document.createElement("div");
  });

  it("supports forwardRef to DOM refs", () => {
    const root = createRoot(container);
    const ref = ReactCompat.createRef<HTMLButtonElement>();

    const Button = ReactCompat.forwardRef<HTMLButtonElement, { id: string }>((props, forwardedRef) =>
      ReactCompat.createElement("button", { id: props.id, ref: forwardedRef }, "Click"),
    );

    root.render(ReactCompat.createElement(Button, { id: "btn", ref }));

    const button = container.querySelector("button");
    expect(button).not.toBeNull();
    expect(ref.current).toBe(button);
  });

  it("provides stable useId values across re-renders", async () => {
    const root = createRoot(container);
    const ids: string[] = [];
    let setCount!: (value: number) => void;

    function App() {
      const [count, set] = ReactCompat.useState(0);
      const id = ReactCompat.useId();
      setCount = set;
      ids.push(id);
      return ReactCompat.createElement("span", { id }, String(count));
    }

    root.render(ReactCompat.createElement(App, null));
    setCount(1);
    await waitForRender();

    expect(ids).toHaveLength(2);
    expect(ids[0]).toBe(ids[1]);
    expect(container.querySelector("span")!.id).toBe(ids[1]);
  });

  it("runs insertion/layout effects synchronously, passive effects deferred", async () => {
    const root = createRoot(container);
    const calls: string[] = [];

    function App() {
      ReactCompat.useInsertionEffect(() => {
        calls.push("insertion");
      }, []);
      ReactCompat.useLayoutEffect(() => {
        calls.push("layout");
      }, []);
      ReactCompat.useEffect(() => {
        calls.push("effect");
      }, []);
      return ReactCompat.createElement("div", null);
    }

    root.render(ReactCompat.createElement(App, null));
    // Insertion and layout are synchronous; passive is deferred (like React)
    expect(calls).toEqual(["insertion", "layout"]);
    await waitForRender();
    expect(calls).toEqual(["insertion", "layout", "effect"]);
  });

  it("renders portals into target containers and cleans them up on unmount", () => {
    const root = createRoot(container);

    function App() {
      return createPortal(
        ReactCompat.createElement("span", { id: "in-portal" }, "Portal"),
        portalContainer,
      );
    }

    root.render(ReactCompat.createElement(App, null));
    expect(portalContainer.querySelector("#in-portal")!.textContent).toBe("Portal");
    expect(container.querySelector("#in-portal")).toBeNull();

    root.unmount();
    expect(portalContainer.querySelector("#in-portal")).toBeNull();
  });

  it("flushSync forces scheduled updates to commit synchronously", () => {
    const root = createRoot(container);
    let setCount!: (value: number) => void;

    function Counter() {
      const [count, set] = ReactCompat.useState(0);
      setCount = set;
      return ReactCompat.createElement("span", null, String(count));
    }

    root.render(ReactCompat.createElement(Counter, null));
    setCount(1);
    expect(container.querySelector("span")!.textContent).toBe("0");

    flushSync(() => {});
    expect(container.querySelector("span")!.textContent).toBe("1");
  });

  it("cloneElement merges props and replaces children", () => {
    const root = createRoot(container);
    const base = ReactCompat.createElement("div", { id: "base", className: "old" }, "one");
    const cloned = ReactCompat.cloneElement(base, { id: "next", className: "new" }, "two");

    root.render(cloned);
    const div = container.querySelector("div")!;
    expect(div.id).toBe("next");
    expect(div.className).toBe("new");
    expect(div.textContent).toBe("two");
  });

  it("supports React.Children helpers", () => {
    const children = [
      ReactCompat.createElement("span", { key: "a" }, "A"),
      null,
      false,
      ReactCompat.createElement("span", { key: "b" }, "B"),
    ];

    expect(ReactCompat.Children.count(children)).toBe(2);
    expect(ReactCompat.Children.toArray(children)).toHaveLength(2);
    expect(ReactCompat.Children.map(children, (child) => child)).toHaveLength(2);
    expect(() => ReactCompat.Children.only(children)).toThrow();
    expect(ReactCompat.Children.only(ReactCompat.createElement("span", null, "only"))).toBeTruthy();
  });

  it("exposes batched updates helper", () => {
    const result = unstable_batchedUpdates(() => 42);
    expect(result).toBe(42);
  });

  it("supports jsx runtime factories", () => {
    const root = createRoot(container);
    const vnode = jsxs("div", {
      id: "jsx-root",
      children: [
        jsx("span", { children: "a" }),
        jsx(Fragment, { children: jsx("span", { children: "b" }) }),
      ],
    });
    root.render(vnode);
    expect(container.querySelector("#jsx-root")!.textContent).toBe("ab");
  });

  it("supports components that return null or arrays", () => {
    const root = createRoot(container);
    const Empty = (() => null) as unknown as (
      props: Record<string, unknown>,
    ) => ReturnType<typeof ReactCompat.createElement>;
    const Pair = (() => [
      ReactCompat.createElement("span", { key: "a" }, "A"),
      ReactCompat.createElement("span", { key: "b" }, "B"),
    ]) as unknown as (
      props: Record<string, unknown>,
    ) => ReturnType<typeof ReactCompat.createElement>;

    root.render(ReactCompat.createElement(Empty, null));
    expect(container.innerHTML).toBe("");

    root.render(ReactCompat.createElement(Pair, null));
    expect(container.textContent).toBe("AB");
  });
});
