import type { ErrorDiagnostic, SupportBundleExportResult } from "@otomat/domain";
import { desktopBridge } from "@web/lib/desktop-bridge";

const REVOKE_DELAY_MS = 1_000;

/** No shell to assemble a bundle: the browser still gets the incident itself, as a plain download. */
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

/**
 * Writes the incident where the user asked for it: into the shell's support bundle when a shell is
 * there, and a download otherwise. Both are explicit, local writes — nothing leaves the machine.
 */
export async function exportDiagnostic(
  diagnostic: ErrorDiagnostic,
): Promise<SupportBundleExportResult> {
  const bridge = desktopBridge();
  if (bridge === null) return downloadDiagnostic(diagnostic);
  return bridge.support.exportBundle(diagnostic);
}
