import { join } from "node:path";

import { app, dialog } from "electron";

import { DATA_RETENTION_POLICY, exportSupportBundle } from "./data-safety/index.js";
import { writeSupportBundleAtomically } from "./data-safety/support/bundle-file.js";

interface DesktopSupportOptions {
  daemonUrl(): string;
  logs(): { desktop: string; daemon: string };
  log(message: string): void;
}

export class DesktopSupport {
  constructor(private readonly options: DesktopSupportOptions) {}

  async exportBundle(): Promise<void> {
    try {
      const exported = await exportSupportBundle({
        versions: {
          desktop: app.getVersion(),
          electron: process.versions.electron ?? "unknown",
          node: process.versions.node,
          platform: process.platform,
          arch: process.arch,
        },
        daemonUrl: this.options.daemonUrl,
        readLogs: () => this.options.logs(),
        chooseDestination: async () => {
          const selected = await dialog.showSaveDialog({
            title: "Export Otomat Support Bundle",
            defaultPath: join(
              app.getPath("documents"),
              `otomat-support-${new Date().toISOString().slice(0, 10)}.json`,
            ),
            filters: [{ name: "JSON", extensions: ["json"] }],
          });
          return selected.canceled ? null : (selected.filePath ?? null);
        },
        write: writeSupportBundleAtomically,
      });
      if (exported.status === "written") {
        await dialog.showMessageBox({
          type: "info",
          title: "Support Bundle Exported",
          message: "The local support bundle was exported.",
          detail: exported.path,
        });
      }
    } catch {
      this.options.log("Support bundle export failed.");
      await dialog.showMessageBox({
        type: "error",
        title: "Support Bundle Failed",
        message: "The support bundle could not be exported.",
      });
    }
  }

  async showDataPolicy(): Promise<void> {
    await dialog.showMessageBox({
      type: "info",
      title: "Otomat Data Retention",
      message: "Local data retention is explicit and manual.",
      detail: DATA_RETENTION_POLICY,
    });
  }
}
