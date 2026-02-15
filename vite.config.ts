import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

function fromRoot(path: string): string {
  return fileURLToPath(new URL(path, import.meta.url));
}

export default defineConfig({
  root: "demo",
  resolve: {
    alias: [
      { find: /^react$/, replacement: fromRoot("./src/refract/compat/react.ts") },
      { find: /^react-dom$/, replacement: fromRoot("./src/refract/compat/react-dom.ts") },
      { find: /^react-dom\/client$/, replacement: fromRoot("./src/refract/compat/react-dom-client.ts") },
      { find: /^react\/jsx-runtime$/, replacement: fromRoot("./src/refract/compat/react-jsx-runtime.ts") },
      { find: /^react\/jsx-dev-runtime$/, replacement: fromRoot("./src/refract/compat/react-jsx-dev-runtime.ts") },
    ],
  },
  esbuild: {
    jsxFactory: "createElement",
    jsxFragment: "Fragment",
  },
  test: {
    root: ".",
    environment: "jsdom",
  },
});
