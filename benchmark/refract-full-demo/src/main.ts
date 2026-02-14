import {
  createContext,
  createElement,
  memo,
  render,
  setHtmlSanitizer,
  useContext,
  useState,
} from "refract";
import type { Props } from "refract";

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
const ThemeContext = createContext("light");

function ImageCardBase(props: Props) {
  const theme = useContext(ThemeContext);

  return createElement(
    "div",
    { className: "card" },
    createElement("img", { src: props.src as string, alt: props.alt as string }),
    createElement("span", {
      dangerouslySetInnerHTML: {
        __html: `${props.captionHtml as string} (${theme})`,
      },
    }),
  );
}

const ImageCard = memo(ImageCardBase);

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

function App() {
  const [currentImages, setCurrentImages] = useState<GalleryImage[]>([...images]);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const shuffle = () => {
    setCurrentImages((prev) => [...prev].sort(() => Math.random() - 0.5));
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return createElement(
    "div",
    { className: "app" },
    createElement("span", { className: "title" }, "Refract Full Entrypoint Image Gallery"),
    createElement(ThemeContext.Provider, { value: theme }, createElement(Gallery, { images: currentImages })),
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
