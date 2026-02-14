import { createElement, render } from "refract/core";
import { createContext, useContext } from "refract/context";
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

const ThemeContext = createContext("light");

function ImageCard(props: Props) {
  const theme = useContext(ThemeContext);

  return createElement(
    "div",
    { className: "card" },
    createElement("img", { src: props.src as string, alt: props.alt as string }),
    createElement("span", null, `${props.caption as string} (${theme})`),
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

function App(props: Props) {
  const items = props.images as GalleryImage[];
  const theme = props.theme as string;
  const onShuffle = props.onShuffle as () => void;

  return createElement(
    "div",
    { className: "app" },
    createElement("span", { className: "title" }, "Refract Core + Context Image Gallery"),
    createElement(ThemeContext.Provider, { value: theme }, createElement(Gallery, { images: items })),
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
let currentTheme: "light" | "dark" = "light";

function rerender(): void {
  render(createElement(App, { images: currentImages, theme: currentTheme, onShuffle: shuffle }), container);
}

function shuffle(): void {
  currentImages = [...currentImages].sort(() => Math.random() - 0.5);
  currentTheme = currentTheme === "light" ? "dark" : "light";
  rerender();
}

rerender();
