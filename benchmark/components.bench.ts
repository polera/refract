// @vitest-environment jsdom

import { bench, describe } from "vitest";
import {
  createContext,
  createElement,
  Fragment,
  memo,
  render,
  useContext,
} from "../src/refract/full.js";
import type { Props } from "../src/refract/types.js";

type Image = {
  src: string;
  alt: string;
  caption: string;
};

type Scenario = {
  memo: boolean;
  context: boolean;
  fragment: boolean;
  keyed: boolean;
};

const IMAGES: Image[] = [
  { src: "img-1.jpg", alt: "Mountain landscape", caption: "Mountains" },
  { src: "img-2.jpg", alt: "Ocean waves", caption: "Ocean" },
  { src: "img-3.jpg", alt: "Forest path", caption: "Forest" },
  { src: "img-4.jpg", alt: "City skyline", caption: "City" },
  { src: "img-5.jpg", alt: "Desert dunes", caption: "Desert" },
  { src: "img-6.jpg", alt: "Snowy peaks", caption: "Snow" },
];

const FLAG_ORDER: Array<keyof Scenario> = ["memo", "context", "fragment", "keyed"];
const BENCH_OPTIONS = { time: 40, warmupTime: 20 };

function allScenarios(): Scenario[] {
  const scenarios: Scenario[] = [];
  const max = 1 << FLAG_ORDER.length;

  for (let mask = 0; mask < max; mask++) {
    const scenario: Scenario = {
      memo: false,
      context: false,
      fragment: false,
      keyed: false,
    };

    for (let i = 0; i < FLAG_ORDER.length; i++) {
      if (mask & (1 << i)) {
        scenario[FLAG_ORDER[i]] = true;
      }
    }

    scenarios.push(scenario);
  }

  return scenarios;
}

function scenarioLabel(scenario: Scenario): string {
  const enabled = FLAG_ORDER.filter((flag) => scenario[flag]);
  return enabled.length > 0 ? enabled.join("+") : "base";
}

function createScenarioApp(scenario: Scenario): (props: Props) => ReturnType<typeof createElement> {
  const ThemeContext = createContext("light");

  function Caption(props: Props) {
    const text = props.caption as string;
    if (!scenario.context) {
      return createElement("span", null, text);
    }

    const theme = useContext(ThemeContext);
    return createElement("span", null, `${text}-${theme}`);
  }

  function CardBase(props: Props) {
    const imageNode = createElement("img", {
      src: props.src as string,
      alt: props.alt as string,
    });
    const captionNode = createElement(Caption, { caption: props.caption as string });

    if (scenario.fragment) {
      return createElement(
        "div",
        { className: "card" },
        createElement(Fragment as unknown as string, null, imageNode, captionNode),
      );
    }

    return createElement("div", { className: "card" }, imageNode, captionNode);
  }

  const Card = scenario.memo ? memo(CardBase) : CardBase;

  function Gallery(props: Props) {
    const phase = props.phase as number;
    const items = phase === 1 ? [...IMAGES].reverse() : IMAGES;

    return createElement(
      "div",
      { className: "gallery" },
      ...items.map((item) => {
        const cardProps: Props = {
          src: item.src,
          alt: item.alt,
          caption: item.caption,
        };
        if (scenario.keyed) {
          cardProps.key = item.caption;
        }
        return createElement(Card, cardProps);
      }),
    );
  }

  function App(props: Props) {
    const phase = props.phase as number;
    const gallery = createElement(Gallery, { phase });

    if (!scenario.context) {
      return createElement("div", { className: "app" }, gallery);
    }

    const theme = phase === 0 ? "light" : "dark";
    return createElement(
      "div",
      { className: "app" },
      createElement(ThemeContext.Provider, { value: theme }, gallery),
    );
  }

  return App;
}

describe("refract component combinations", () => {
  for (const scenario of allScenarios()) {
    const label = scenarioLabel(scenario);
    const App = createScenarioApp(scenario);

    bench(
      `${label}: mount`,
      () => {
        const container = document.createElement("div");
        render(createElement(App, { phase: 0 }), container);
      },
      BENCH_OPTIONS,
    );

    bench(
      `${label}: reconcile`,
      () => {
        const container = document.createElement("div");
        render(createElement(App, { phase: 0 }), container);
        render(createElement(App, { phase: 1 }), container);
      },
      BENCH_OPTIONS,
    );
  }
});
