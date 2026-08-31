import "@otomat/ui/styles.css";
import { ThemeProvider } from "@otomat/ui";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { GalleryApp } from "./app";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

// The row primitives render router Links; a memory router lets them build hrefs standalone.
const router = createRouter({
  routeTree: createRootRoute({ component: GalleryApp }),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

createRoot(root).render(
  <StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </StrictMode>,
);
