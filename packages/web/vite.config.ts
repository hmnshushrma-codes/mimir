import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  },
  build: {
    rollupOptions: {
      // docs.html is a standalone static page (no React) served at /docs.html
      input: {
        main: resolve(__dirname, "index.html"),
        docs: resolve(__dirname, "docs.html")
      }
    }
  }
});
