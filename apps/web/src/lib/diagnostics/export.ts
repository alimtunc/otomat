import type { ErrorDiagnostic, SupportBundleExportResult } from "@otomat/domain";
import { desktopBridge } from "@web/lib/desktop-bridge";

const REVOKE_DELAY_MS = 1_000;

function downloadDiagnostic(diagnostic: ErrorDiagnostic): SupportBundleExportResult {
  const filename = `otomat-diagnostic-${diagnostic.id}.json`;
  const url = URL.createObjectURL(
    new Blob([`${JSON.stringify(diagnostic, null, 2)}\n`], { type: "application/json" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS);
  return { status: "written", path: filename };
}

/** Both paths are explicit, local writes — nothing leaves the machine. */
export async function exportDiagnostic(
  diagnostic: ErrorDiagnostic,
): Promise<SupportBundleExportResult> {
  const bridge = desktopBridge();
  if (bridge === null) return downloadDiagnostic(diagnostic);
  return bridge.support.exportBundle(diagnostic);
}
