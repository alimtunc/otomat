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
// Before the lock: Electron keys the single-instance lock on userData, so a shared userData
// would make the second instance quit into the first one instead of running isolated. Dev
// worktrees split per checkout; every other channel splits by the channel the build declared —
// a build that declared none lands in `unknown`, never in stable or local data. An explicit
// --user-data-dir (the packaged smoke, a second test profile) outranks both splits.
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
    .catch(() => {
      console.error("[otomat-desktop] startup failed");
      app.quit();
    });
}
