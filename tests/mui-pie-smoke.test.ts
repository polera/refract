import { createRequire } from "node:module";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { PieChart } from "@mui/x-charts/PieChart";
import { registerExternalReactModule } from "../src/refract/compat/react.js";

const require = createRequire(import.meta.url);
const externalReact = require("react") as typeof React;
registerExternalReactModule(externalReact);

describe("@mui/x-charts PieChart compatibility smoke", () => {
  it("mounts a PieChart tree with legend and surface", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    root.render(
      React.createElement(PieChart, {
        width: 240,
        height: 180,
        skipAnimation: true,
        series: [
          {
            data: [
              { id: 0, value: 40, label: "A" },
              { id: 1, value: 60, label: "B" },
            ],
            innerRadius: 40,
            outerRadius: 70,
            paddingAngle: 2,
            cornerRadius: 4,
          },
        ],
      }),
    );

    await new Promise<void>((resolve) => setTimeout(resolve, 25));

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();

    const legendItems = container.querySelectorAll(".MuiChartsLegend-item");
    expect(legendItems.length).toBe(2);

    const surface = container.querySelector(".MuiChartsSurface-root");
    expect(surface).not.toBeNull();
    expect(container.querySelector("svg g")).not.toBeNull();
    expect(container.querySelector("undefined")).toBeNull();

    root.unmount();
    container.remove();
  });
});
