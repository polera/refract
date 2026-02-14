import { createElement, render } from "refract/core";
import { setHtmlSanitizer } from "refract/security";
import type { Props } from "refract/core";

type GalleryImage = {
  src: string;
  alt: string;
  captionHtml: string;
};

const images: GalleryImage[] = [
  {
    src: "https://picsum.photos/seed/refract1/400/300",
    alt: "Mountain landscape",
    captionHtml: "<strong>Mountains</strong>",
  },
  {
    src: "https://picsum.photos/seed/refract2/400/300",
    alt: "Ocean waves",
    captionHtml: "<strong>Ocean</strong>",
  },
  {
    src: "https://picsum.photos/seed/refract3/400/300",
    alt: "Forest path",
    captionHtml: "<strong>Forest</strong>",
  },
  {
    src: "https://picsum.photos/seed/refract4/400/300",
    alt: "City skyline",
    captionHtml: "<strong>City</strong>",
  },
  {
    src: "https://picsum.photos/seed/refract5/400/300",
    alt: "Desert dunes",
    captionHtml: "<strong>Desert</strong>",
  },
  {
    src: "https://picsum.photos/seed/refract6/400/300",
    alt: "Snowy peaks",
    captionHtml: "<strong>Snow</strong>",
  },
];

setHtmlSanitizer(null);

function ImageCard(props: Props) {
  return createElement(
    "div",
    { className: "card" },
    createElement("img", { src: props.src as string, alt: props.alt as string }),
    createElement("span", {
      dangerouslySetInnerHTML: {
        __html: props.captionHtml as string,
      },
    }),
  );
}

function Gallery(props: Props) {
  const items = props.images as GalleryImage[];
  return createElement(
    "div",
    { className: "gallery" },
    ...items.map((img) =>
      createElement(ImageCard, { key: img.captionHtml, src: img.src, alt: img.alt, captionHtml: img.captionHtml }),
    ),
  );
}

function App(props: Props) {
  const items = props.images as GalleryImage[];
  const onShuffle = props.onShuffle as () => void;

  return createElement(
    "div",
    { className: "app" },
    createElement("span", { className: "title" }, "Refract Core + Security Image Gallery"),
    createElement(Gallery, { images: items }),
    createElement(
      "div",
      { className: "controls" },
      createElement("div", { className: "btn", onClick: onShuffle }, "Shuffle"),
    ),
  );
}

const container = document.getElementById("app");
if (!container) {
  throw new Error("Missing #app container");
}

let currentImages = [...images];

function rerender(): void {
  render(createElement(App, { images: currentImages, onShuffle: shuffle }), container);
}

function shuffle(): void {
  currentImages = [...currentImages].sort(() => Math.random() - 0.5);
  rerender();
}

rerender();
