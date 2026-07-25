import { app } from "electron";

import { DesktopApp } from "./desktop-app.js";
import { registerAppSchemePrivileged } from "./protocol.js";

registerAppSchemePrivileged();

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
      desktop = new DesktopApp();
      await desktop.onReady();
    })
    .catch(() => {
      console.error("[otomat-desktop] startup failed");
      app.quit();
    });
}
