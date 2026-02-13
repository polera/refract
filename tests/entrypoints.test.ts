import { describe, it, expect, vi } from "vitest";

describe("entrypoints", () => {
  it("core exports only the minimal runtime surface", async () => {
    vi.resetModules();
    const core = await import("../src/refract/core.js") as Record<string, unknown>;

    expect(typeof core.createElement).toBe("function");
    expect(typeof core.render).toBe("function");
    expect(core.useState).toBeUndefined();
    expect(core.memo).toBeUndefined();
    expect(core.setDevtoolsHook).toBeUndefined();
  });

  it("full exports extended APIs", async () => {
    vi.resetModules();
    const full = await import("../src/refract/full.js") as Record<string, unknown>;

    expect(typeof full.createElement).toBe("function");
    expect(typeof full.render).toBe("function");
    expect(typeof full.useState).toBe("function");
    expect(typeof full.memo).toBe("function");
    expect(typeof full.setDevtoolsHook).toBe("function");
  });

  it("core render does not auto-enable the security sanitizer", async () => {
    vi.resetModules();
    const core = await import("../src/refract/core.js");
    const container = document.createElement("div");

    core.render(
      core.createElement("div", {
        dangerouslySetInnerHTML: {
          __html: "<a href=\"javascript:alert(1)\">x</a><script>evil()</script>",
        },
      }),
      container,
    );

    const div = container.querySelector("div")!;
    expect(div.querySelector("script")).not.toBeNull();
    expect(div.querySelector("a")!.getAttribute("href")).toBe("javascript:alert(1)");
  });

  it("full render enables sanitizer defaults", async () => {
    vi.resetModules();
    const full = await import("../src/refract/full.js");
    const container = document.createElement("div");

    full.render(
      full.createElement("div", {
        dangerouslySetInnerHTML: {
          __html: "<a href=\"javascript:alert(1)\">x</a><script>evil()</script>",
        },
      }),
      container,
    );

    const div = container.querySelector("div")!;
    expect(div.querySelector("script")).toBeNull();
    expect(div.querySelector("a")!.getAttribute("href")).toBeNull();
  });
});
