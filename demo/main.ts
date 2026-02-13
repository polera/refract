import { createElement, render } from "../src/refract/core.js";
import { useState } from "../src/refract/features/hooks.js";
import type { Props } from "../src/refract/types.js";

const images = [
  { src: "https://picsum.photos/seed/refract1/400/300", alt: "Mountain landscape", caption: "Mountains" },
  { src: "https://picsum.photos/seed/refract2/400/300", alt: "Ocean waves", caption: "Ocean" },
  { src: "https://picsum.photos/seed/refract3/400/300", alt: "Forest path", caption: "Forest" },
  { src: "https://picsum.photos/seed/refract4/400/300", alt: "City skyline", caption: "City" },
  { src: "https://picsum.photos/seed/refract5/400/300", alt: "Desert dunes", caption: "Desert" },
  { src: "https://picsum.photos/seed/refract6/400/300", alt: "Snowy peaks", caption: "Snow" },
];

function ImageCard(props: Props) {
  return createElement(
    "div",
    { className: "card", key: props.caption as string },
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
      createElement(ImageCard, { key: img.caption, src: img.src, alt: img.alt, caption: img.caption }),
    ),
  );
}

function App() {
  const [currentImages, setImages] = useState([...images]);

  const shuffle = () => {
    setImages((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  return createElement(
    "div",
    { className: "app" },
    createElement("span", { className: "title" }, "Refract Image Gallery"),
    createElement(Gallery, { images: currentImages }),
    createElement(
      "div",
      { className: "controls" },
      createElement("div", { className: "btn", onClick: shuffle }, "Shuffle"),
    ),
  );
}

function shouldMountInspector(): boolean {
  if (typeof window === "undefined") return false;
  const value = new URLSearchParams(window.location.search).get("inspector");
  return value !== "0" && value !== "false";
}

const inspectorEnabled = import.meta.env.DEV || import.meta.env.VITE_REFRACT_ENABLE_INSPECTOR === "1";
if (inspectorEnabled && shouldMountInspector()) {
  void import("./inspector.js").then(({ mountInspector }) => {
    mountInspector(document.getElementById("inspector-root"));
  });
}
render(createElement(App, null), document.getElementById("app")!);
