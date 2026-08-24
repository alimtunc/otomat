import type { DesktopUpdateFeed, DesktopUpdateRelease } from "@otomat/domain";
import { autoUpdater } from "electron-updater";

import type { UpdaterPort } from "./controller.js";

/** electron-updater publishes notes as prose or as one entry per release; both arrive as markdown. */
function releaseNotes(notes: string | { note: string | null }[] | null | undefined): string {
  if (typeof notes === "string") return notes;
  if (!Array.isArray(notes)) return "";
  return notes
    .map((entry) => entry.note ?? "")
    .filter((note) => note.length > 0)
    .join("\n\n");
}

export function createElectronUpdaterPort(
  feed: DesktopUpdateFeed,
  log: (message: string) => void,
): UpdaterPort {
  autoUpdater.autoDownload = false;
  // Squirrel would otherwise swap the app on the next quit — the silent install this updater refuses.
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = feed === "prerelease";
  autoUpdater.logger = null;
  autoUpdater.on("error", (error: Error) => log(`electron-updater: ${error.message}`));

  return {
    async check(): Promise<DesktopUpdateRelease | null> {
      const result = await autoUpdater.checkForUpdates();
      if (result === null) return null;
      const { updateInfo } = result;
      return {
        version: updateInfo.version,
        notes: releaseNotes(updateInfo.releaseNotes),
        released_at: updateInfo.releaseDate,
      };
    },
    async download(): Promise<void> {
      await autoUpdater.downloadUpdate();
    },
    quitAndInstall(): void {
      autoUpdater.quitAndInstall();
    },
    onProgress(listener: (percent: number) => void): void {
      autoUpdater.on("download-progress", (progress: { percent: number }) =>
        listener(progress.percent),
      );
    },
  };
}
