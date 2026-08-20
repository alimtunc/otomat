import type { DaemonClientConfig } from "@otomat/client";
import type { PreviewManifest } from "@otomat/domain";
import { readPreviewManifest } from "@web/preview/manifest";
import { probePreviewDaemon } from "@web/preview/probe";
import { previewSessionState, type PreviewSessionState } from "@web/preview/state";

type Sandbox = Extract<PreviewSessionState, { state: "sandbox" }>;
type Live = Extract<PreviewSessionState, { state: "live" }>;
type Blocked = Extract<PreviewSessionState, { state: "blocked" }>;

export type PreviewSession =
  | (Sandbox & { manifest: PreviewManifest; transport: DaemonClientConfig })
  | (Live & { manifest: PreviewManifest })
  // The manifest itself can be what failed, and then there is no pull request to name.
  | (Blocked & { manifest: PreviewManifest | null });

let resolved: PreviewSession | null = null;

async function resolveSession(): Promise<PreviewSession | null> {
  const manifest = await readPreviewManifest();
  if (manifest === null) return null;
  const state = previewSessionState(manifest.build, await probePreviewDaemon());
  if (state.state === "sandbox") {
    const { sandboxTransport } = await import("@web/preview/sandbox/transport");
    return { ...state, manifest, transport: sandboxTransport(manifest.build) };
  }
  return { ...state, manifest };
}

/** A daemon that appears later is picked up by reloading, not by swapping the transport under mounted queries. */
export async function openPreviewSession(): Promise<PreviewSession | null> {
  try {
    resolved = await resolveSession();
  } catch (error) {
    resolved = {
      state: "blocked",
      cause: { kind: "unreadable", detail: error instanceof Error ? error.message : String(error) },
      manifest: null,
    };
  }
  return resolved;
}

/** The session `openPreviewSession` resolved for this load; null outside a web preview. */
export function previewSession(): PreviewSession | null {
  return resolved;
}
