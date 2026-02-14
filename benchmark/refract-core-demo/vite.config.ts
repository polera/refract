import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      "refract/security": resolve(__dirname, "../../src/refract/features/security.ts"),
      refract: resolve(__dirname, "../../src/refract"),
    },
  },
  build: {
    outDir: "dist",
  },
});
