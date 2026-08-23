import type { LinearSyncStatusContract } from "@otomat/domain";

export interface LinearSyncLabel {
  text: string;
  tone: "muted" | "danger";
  syncedAt: string | null;
}

export function linearSourcesMapped(status: LinearSyncStatusContract | null): boolean {
  return (status?.sources ?? 0) > 0;
}

const muted = (text: string, syncedAt: string | null = null): LinearSyncLabel => ({
  text,
  tone: "muted",
  syncedAt,
});

export function describeLinearSync(
  status: LinearSyncStatusContract | null,
  running: boolean,
): LinearSyncLabel {
  if (status === null) return muted("");
  if (status.sources === 0) return muted("No Linear team mapped");
  if (running) return muted("Syncing…");
  if (status.last_error !== null) {
    return { text: status.last_error.message, tone: "danger", syncedAt: null };
  }
  if (status.last_synced_at === null) return muted("Never synced");
  const changes = status.last_result;
  if (changes === null) return muted("Last sync", status.last_synced_at);
  if (changes.imported + changes.updated === 0) return muted("No changes", status.last_synced_at);
  return muted(`${changes.imported} imported, ${changes.updated} updated`, status.last_synced_at);
}
