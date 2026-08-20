import "@otomat/ui/styles.css";
import "@git-diff-view/react/styles/diff-view.css";
import "@web/components/runs/diff/review-diff.css";
import { openPreviewSession } from "@web/preview/session";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

// The preview session decides the daemon transport, and `api/client` reads it when its module is
// evaluated — so the app graph is imported only once that session is resolved.
void openPreviewSession().then(async () => {
  const { Cockpit } = await import("@web/cockpit");
  createRoot(root).render(
    <StrictMode>
      <Cockpit />
    </StrictMode>,
  );
});
