import { PREVIEW_MANIFEST_PATH, previewManifestSchema, type PreviewManifest } from "@otomat/domain";
import { desktopBridge } from "@web/lib/desktop-bridge";

/**
 * Null for every build that is not a web preview: the desktop shell is told by its own bridge, and
 * a dev server or a packaged build simply has no manifest beside its assets. A manifest that is
 * present but unreadable throws, because that is a broken deployment rather than another product.
 */
export async function readPreviewManifest(
  fetchImpl: typeof fetch = fetch,
): Promise<PreviewManifest | null> {
  if (desktopBridge() !== null) return null;
  const response = await fetchImpl(PREVIEW_MANIFEST_PATH, {
    headers: { accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`The preview manifest answered ${String(response.status)}.`);
  }
  return previewManifestSchema.parse(await response.json());
}
