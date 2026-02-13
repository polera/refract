import { createElement, render } from "../src/refract/index.js";
import type { Props } from "../src/refract/types.js";

// --- Data ---

const images = [
  { src: "https://picsum.photos/seed/refract1/400/300", alt: "Mountain landscape", caption: "Mountains" },
  { src: "https://picsum.photos/seed/refract2/400/300", alt: "Ocean waves", caption: "Ocean" },
  { src: "https://picsum.photos/seed/refract3/400/300", alt: "Forest path", caption: "Forest" },
  { src: "https://picsum.photos/seed/refract4/400/300", alt: "City skyline", caption: "City" },
  { src: "https://picsum.photos/seed/refract5/400/300", alt: "Desert dunes", caption: "Desert" },
  { src: "https://picsum.photos/seed/refract6/400/300", alt: "Snowy peaks", caption: "Snow" },
];

// --- Components ---

function ImageCard(props: Props) {
  return createElement(
    "div",
    { className: "card" },
    createElement("img", { src: props.src as string, alt: props.alt as string }),
    createElement("span", null, props.caption as string),
  );
}

function Gallery(props: Props) {
  const items = props.images as typeof images;
  return createElement(
    "div",
    { className: "gallery" },
    ...items.map((img) =>
      createElement(ImageCard, { src: img.src, alt: img.alt, caption: img.caption }),
    ),
  );
}

function App(props: Props) {
  const items = props.images as typeof images;
  return createElement(
    "div",
    { className: "app" },
    createElement("span", { className: "title" }, "Refract Image Gallery"),
    createElement(Gallery, { images: items }),
    createElement(
      "div",
      { className: "controls" },
      createElement("div", {
        className: "btn",
        onClick: props.onShuffle as EventListener,
      }, "Shuffle"),
    ),
  );
}

// --- Rendering ---

let currentImages = [...images];

function draw() {
  const app = createElement(App, {
    images: currentImages,
    onShuffle: () => {
      currentImages = [...currentImages].sort(() => Math.random() - 0.5);
      draw();
    },
  });
  render(app, document.getElementById("app")!);
}

draw();
