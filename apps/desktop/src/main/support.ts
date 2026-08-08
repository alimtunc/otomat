import { join } from "node:path";

import type {
  ErrorDiagnostic,
  ProblemReportDraft,
  SupportBundleExportResult,
} from "@otomat/domain";
import { app, dialog, shell } from "electron";

import { readBuildInfo } from "./build-info.js";
import { DATA_RETENTION_POLICY, exportSupportBundle } from "./data-safety/index.js";
import { writeSupportBundleAtomically } from "./data-safety/support/bundle-file.js";

interface DesktopSupportOptions {
  daemonUrl(): string;
  logs(): { desktop: string; daemon: string };
  log(message: string): void;
}

const ISSUE_DRAFT_URL = "https://github.com/alimtunc/otomat/issues/new";
// GitHub rejects a request line beyond roughly 8 KB; a draft that would be refused is worse than
// a shorter one, so the body is cut here rather than by the server.
const MAX_DRAFT_BODY_CHARACTERS = 6_000;

function issueDraftUrl(draft: ProblemReportDraft): string {
  const url = new URL(ISSUE_DRAFT_URL);
  url.searchParams.set("title", draft.title);
  url.searchParams.set("body", draft.body.slice(0, MAX_DRAFT_BODY_CHARACTERS));
  return url.toString();
}

function failureMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export class DesktopSupport {
  constructor(private readonly options: DesktopSupportOptions) {}

  async exportBundle(incident: ErrorDiagnostic | null = null): Promise<SupportBundleExportResult> {
    try {
      const build = readBuildInfo(this.options.log);
      const exported = await exportSupportBundle({
        versions: {
          desktop: build.version,
          commit: build.commit,
          channel: build.channel,
          signed: build.signed,
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
        incident,
      });
      return exported;
    } catch (error) {
      this.options.log(`Support bundle export failed: ${failureMessage(error)}`);
      return { status: "failed", message: "The support bundle could not be exported." };
    }
  }

  /** The menu and splash have no renderer to report into, so the outcome is a native dialog. */
  async exportBundleWithFeedback(): Promise<void> {
    const exported = await this.exportBundle();
    if (exported.status === "written") {
      await dialog.showMessageBox({
        type: "info",
        title: "Support Bundle Exported",
        message: "The local support bundle was exported.",
        detail: exported.path,
      });
      return;
    }
    if (exported.status === "failed") {
      await dialog.showMessageBox({
        type: "error",
        title: "Support Bundle Failed",
        message: exported.message,
      });
    }
  }

  /** Called only after the renderer's preview dialog was confirmed; it opens a draft, never posts. */
  async openReportDraft(draft: ProblemReportDraft): Promise<void> {
    await shell.openExternal(issueDraftUrl(draft));
  }

  async showDataPolicy(): Promise<void> {
    await dialog.showMessageBox({
      type: "info",
      title: "Otomat Data Retention",
      message: "Local data retention is explicit and manual.",
      detail: DATA_RETENTION_POLICY,
    });
  }

  async confirmRestore(): Promise<boolean> {
    const confirmation = await dialog.showMessageBox({
      type: "warning",
      title: "Restore Otomat data?",
      message: "Restore the last known backup?",
      detail:
        "The current database and its WAL files will be preserved in the backups directory before restoration. Otomat will then restart its local daemon.",
      buttons: ["Cancel", "Restore Backup"],
      defaultId: 0,
      cancelId: 0,
      noLink: true,
    });
    return confirmation.response === 1;
  }
}
