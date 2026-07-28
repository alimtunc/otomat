import { app } from "electron";

import { DesktopApp } from "./desktop-app.js";
import { applyDevDataRoot } from "./dev-data-root.js";
import { resolveAppPaths } from "./paths.js";
import { registerAppSchemePrivileged } from "./protocol.js";

registerAppSchemePrivileged();

const paths = resolveAppPaths();
// Before the lock: Electron keys the single-instance lock on userData, so a shared dev userData
// would make the second worktree's shell quit into the first one instead of running isolated.
applyDevDataRoot(paths.devDataRoot, app);

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  let desktop: DesktopApp | null = null;

  app.on("second-instance", () => desktop?.focusPrimary());
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (desktop !== null && desktop.beginQuitIfNeeded(() => app.quit())) event.preventDefault();
  });

  app
    .whenReady()
    .then(async () => {
      desktop = new DesktopApp(paths);
      await desktop.onReady();
    })
    .catch(() => {
      console.error("[otomat-desktop] startup failed");
      app.quit();
    });
}
