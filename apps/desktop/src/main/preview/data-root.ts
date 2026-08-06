import { join } from "node:path";

const PREVIEW_DATA_DIRECTORY_NAME = "Otomat Preview";

export interface PreviewDataRootOptions {
  packaged: boolean;
  /** `BuildInfo.signed`: true only for a Developer ID signed, notarized release. */
  signed: boolean;
  /** `BuildInfo.pr_number`: the pull request this preview was packaged for, or null. */
  prNumber: number | null;
  /** Electron's `appData` directory — the parent of the stable install's userData. */
  appData: string;
}

/**
 * Packaged builds that are not signed releases are previews under test. Their data — SQLite,
 * logs, the single-instance lock — lives beside the stable install, never inside it, so a
 * preview runs side by side with the stable app and can be wiped without touching it. A preview
 * packaged for a pull request gets its own folder per PR, so two of them under test at the same
 * time share nothing either.
 */
export function resolvePreviewDataRoot(options: PreviewDataRootOptions): string | null {
  if (!options.packaged || options.signed) return null;
  const name =
    options.prNumber === null
      ? PREVIEW_DATA_DIRECTORY_NAME
      : `${PREVIEW_DATA_DIRECTORY_NAME} PR ${String(options.prNumber)}`;
  return join(options.appData, name);
}
