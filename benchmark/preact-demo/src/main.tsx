import { useState } from "preact/hooks";
import { render } from "preact";

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

function ImageCard({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  return (
    <div class="card">
      <img src={src} alt={alt} />
      <span>{caption}</span>
    </div>
  );
}

function Gallery({ images }: { images: typeof import("./main").images }) {
  return (
    <div class="gallery">
      {images.map((img, i) => (
        <ImageCard key={i} src={img.src} alt={img.alt} caption={img.caption} />
      ))}
    </div>
  );
}

function App() {
  const [currentImages, setCurrentImages] = useState([...images]);

  const handleShuffle = () => {
    setCurrentImages((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  return (
    <div class="app">
      <span class="title">Preact Image Gallery</span>
      <Gallery images={currentImages} />
      <div class="controls">
        <div class="btn" onClick={handleShuffle}>
          Shuffle
        </div>
      </div>
    </div>
  );
}

// --- Rendering ---

render(<App />, document.getElementById("app")!);
