import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement } from "../src/refract/createElement.js";
import { render } from "../src/refract/render.js";
import {
  DEVTOOLS_GLOBAL_HOOK,
  setDevtoolsHook,
  type RefractDevtoolsFiberSnapshot,
  type RefractDevtoolsRootSnapshot,
} from "../src/refract/devtools.js";

describe("devtools", () => {
  let container: HTMLDivElement;
  const globalScope = globalThis as Record<string, unknown>;

  beforeEach(() => {
    container = document.createElement("div");
    setDevtoolsHook();
    delete globalScope[DEVTOOLS_GLOBAL_HOOK];
  });

  afterEach(() => {
    setDevtoolsHook();
    delete globalScope[DEVTOOLS_GLOBAL_HOOK];
  });

  it("publishes commit and unmount snapshots through the global hook", () => {
    const inject = vi.fn(() => 3);
    const onCommitFiberRoot = vi.fn();
    const onCommitFiberUnmount = vi.fn();

    globalScope[DEVTOOLS_GLOBAL_HOOK] = {
      inject,
      onCommitFiberRoot,
      onCommitFiberUnmount,
    };

    render(
      createElement(
        "div",
        { id: "app" },
        createElement("span", { id: "old" }, "before"),
      ),
      container,
    );
    render(
      createElement(
        "div",
        { id: "app" },
        createElement("p", { id: "new" }, "after"),
      ),
      container,
    );

    expect(inject).toHaveBeenCalledTimes(1);
    expect(onCommitFiberRoot).toHaveBeenCalledTimes(2);
    expect(onCommitFiberUnmount).toHaveBeenCalled();

    const [, latestRoot] = onCommitFiberRoot.mock.calls[1] as [number, RefractDevtoolsRootSnapshot];
    expect(latestRoot.current?.type).toBe("div");
    expect(latestRoot.current?.children[0].type).toBe("p");
    expect(latestRoot.current?.children[0].props.id).toBe("new");

    const unmountSnapshots = onCommitFiberUnmount.mock.calls.map(
      (call) => call[1] as RefractDevtoolsFiberSnapshot,
    );
    const removedSpan = unmountSnapshots.find((snapshot) => snapshot.type === "span");
    expect(removedSpan?.props.id).toBe("old");
  });

  it("uses an explicitly configured hook when setDevtoolsHook is provided", () => {
    const globalInject = vi.fn(() => 1);
    globalScope[DEVTOOLS_GLOBAL_HOOK] = {
      inject: globalInject,
      onCommitFiberRoot: vi.fn(),
    };

    const explicitInject = vi.fn(() => 9);
    const explicitCommit = vi.fn();
    setDevtoolsHook({
      inject: explicitInject,
      onCommitFiberRoot: explicitCommit,
    });

    render(createElement("div", { className: "local" }), container);

    expect(explicitInject).toHaveBeenCalledTimes(1);
    expect(explicitCommit).toHaveBeenCalledTimes(1);
    expect(globalInject).not.toHaveBeenCalled();
  });
});
