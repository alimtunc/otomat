import { resolve } from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const DAEMON_TARGET = "http://localhost:4319";
// `pnpm back` defaults to the same dev token, so the two-terminal flow needs no shared setup.
const DAEMON_API_TOKEN = process.env.OTOMAT_API_TOKEN ?? "otomat-dev";

export default defineConfig({
  plugins: [tanstackRouter({ target: "react" }), react(), tailwindcss()],
  resolve: {
    alias: { "@web": resolve(import.meta.dirname, "src") },
  },
  server: {
    proxy: {
      "/api": {
        target: DAEMON_TARGET,
        changeOrigin: true,
        headers: { authorization: `Bearer ${DAEMON_API_TOKEN}` },
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        gallery: resolve(import.meta.dirname, "gallery.html"),
      },
    },
  },
});
