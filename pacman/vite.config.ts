import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "audio",
  build: {
    target: "es2022",
    sourcemap: true,
  },
});
