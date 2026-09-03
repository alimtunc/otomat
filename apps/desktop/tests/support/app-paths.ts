import type { AppPaths } from "#main/paths";

export function devAppPaths(overrides: Partial<AppPaths> = {}): AppPaths {
  return {
    packaged: false,
    daemonEntry: "/tmp/daemon.js",
    webDist: null,
    splashHtml: "/tmp/splash.html",
    trayIcon: "/tmp/tray-icon.png",
    sandboxTemplateDir: "/tmp/otomat-sandbox-template",
    cockpitPreload: "/tmp/cockpit.cjs",
    splashPreload: "/tmp/splash.cjs",
    devDataRoot: "/tmp/otomat-dev-root",
    ...overrides,
  };
}
