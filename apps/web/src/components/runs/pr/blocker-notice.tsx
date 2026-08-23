import type { PublicationBlocker } from "@otomat/domain";

export function PullRequestBlockerNotice({ blocker }: { blocker: PublicationBlocker | null }) {
  if (blocker === null) return null;
  return (
    <p role="alert" className="rounded-lg border border-danger/40 bg-card p-3 text-sm text-danger">
      {blocker.message}
    </p>
  );
}
