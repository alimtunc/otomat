import { app } from "electron";

import { DesktopApp } from "./app.js";
import { readBuildInfo } from "./build-info.js";
import { applyDevDataRoot } from "./dev-data-root.js";
import { resolveAppPaths } from "./paths.js";
import { resolvePreviewDataRoot } from "./preview-data-root.js";
import { registerAppSchemePrivileged } from "./protocol.js";

registerAppSchemePrivileged();

const paths = resolveAppPaths();
// Before the lock: Electron keys the single-instance lock on userData, so a shared userData
// would make the second instance quit into the first one instead of running isolated. Dev
// worktrees split per checkout; packaged previews (unsigned builds, including unidentifiable
// ones — when in doubt, stay out of the stable data) split beside the stable install.
applyDevDataRoot(
  paths.devDataRoot ??
    resolvePreviewDataRoot({
      packaged: paths.packaged,
      signed: readBuildInfo((message) => console.error(`[otomat-desktop] ${message}`)).signed,
      appData: app.getPath("appData"),
    }),
  app,
);

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
