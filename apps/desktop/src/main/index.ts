import { app } from "electron";

import { DesktopApp } from "./app.js";
import { readBuildInfo } from "./build-info.js";
import { resolveChannelDataRoot } from "./channel-data-root.js";
import { resolveAppPaths } from "./paths.js";
import { registerAppSchemePrivileged } from "./protocol.js";
import { applyUserDataRoot } from "./user-data-root.js";

registerAppSchemePrivileged();

const paths = resolveAppPaths();
const buildInfo = readBuildInfo((message) => console.error(`[otomat-desktop] ${message}`));
applyUserDataRoot(
  app.commandLine.hasSwitch("user-data-dir")
    ? null
    : (paths.devDataRoot ??
        resolveChannelDataRoot({
          channel: buildInfo.channel,
          prNumber: buildInfo.pr_number,
          appData: app.getPath("appData"),
          env: process.env,
        })),
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
      desktop = new DesktopApp(paths, buildInfo);
      await desktop.onReady();
    })
    .catch((error: unknown) => {
      console.error(`[otomat-desktop] startup failed: ${String(error)}`);
      app.quit();
    });
}
