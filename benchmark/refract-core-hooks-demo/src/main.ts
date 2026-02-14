import { createElement, render } from "refract/core";
import { useState } from "refract/hooks";
import type { Props } from "refract/core";

type GalleryImage = {
  src: string;
  alt: string;
  caption: string;
};

const images: GalleryImage[] = [
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
    { className: "card" },
    createElement("img", { src: props.src as string, alt: props.alt as string }),
    createElement("span", null, props.caption as string),
  );
}

function Gallery(props: Props) {
  const items = props.images as GalleryImage[];
  return createElement(
    "div",
    { className: "gallery" },
    ...items.map((img) =>
      createElement(ImageCard, { key: img.caption, src: img.src, alt: img.alt, caption: img.caption }),
    ),
  );
}

function App() {
  const [currentImages, setCurrentImages] = useState<GalleryImage[]>([...images]);

  const shuffle = () => {
    setCurrentImages((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  return createElement(
    "div",
    { className: "app" },
    createElement("span", { className: "title" }, "Refract Core + Hooks Image Gallery"),
    createElement(Gallery, { images: currentImages }),
    createElement(
      "div",
      { className: "controls" },
      createElement("div", { className: "btn", onClick: shuffle }, "Shuffle"),
    ),
  );
}

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container");
}

render(createElement(App, null), container);
