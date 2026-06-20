import "@otomat/ui/styles.css";
import { ThemeProvider } from "@otomat/ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { GalleryApp } from "./app";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <GalleryApp />
    </ThemeProvider>
  </StrictMode>,
);
