import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { DAEMON_TOKEN_FILE, daemonAuthorization } from "@otomat/domain";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const DAEMON_TARGET = "http://localhost:4319";
const DAEMON_DB =
  process.env.OTOMAT_DB_PATH ?? resolve(import.meta.dirname, "../local-daemon/.data/otomat.db");
const DAEMON_TOKEN_PATH = join(dirname(DAEMON_DB), DAEMON_TOKEN_FILE);

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
        // Browsers stamp Sec-Fetch-Site themselves: another origin reaching this proxy gets no token.
        configure: (proxy) =>
          proxy.on("proxyReq", (request, incoming) => {
            if (incoming.headers["sec-fetch-site"] !== "same-origin") return;
            if (!existsSync(DAEMON_TOKEN_PATH)) return;
            request.setHeader(
              "authorization",
              daemonAuthorization(readFileSync(DAEMON_TOKEN_PATH, "utf8")),
            );
          }),
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
