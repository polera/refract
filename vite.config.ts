import { defineConfig } from "vite";

export default defineConfig({
  root: "demo",
  esbuild: {
    jsxFactory: "createElement",
    jsxFragment: "Fragment",
  },
  test: {
    root: ".",
    environment: "jsdom",
  },
});
