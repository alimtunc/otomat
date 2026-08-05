import { join } from "node:path";

const PREVIEW_DATA_DIRECTORY_NAME = "Otomat Preview";

export interface PreviewDataRootOptions {
  packaged: boolean;
  /** `BuildInfo.signed`: true only for a Developer ID signed, notarized release. */
  signed: boolean;
  /** Electron's `appData` directory — the parent of the stable install's userData. */
  appData: string;
}

/**
 * Packaged builds that are not signed releases are previews under test. Their data — SQLite,
 * logs, the single-instance lock — lives beside the stable install, never inside it, so a
 * preview runs side by side with the stable app and can be wiped without touching it.
 */
export function resolvePreviewDataRoot(options: PreviewDataRootOptions): string | null {
  if (!options.packaged || options.signed) return null;
  return join(options.appData, PREVIEW_DATA_DIRECTORY_NAME);
}
