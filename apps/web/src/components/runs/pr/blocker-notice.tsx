import type { PublicationBlocker } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { Link } from "@tanstack/react-router";

export function PullRequestBlockerNotice({
  blocker,
  runId,
  issueId,
}: {
  blocker: PublicationBlocker | null;
  runId: string;
  issueId: string | null;
}) {
  if (blocker === null) return null;
  return (
    <section
      role="alert"
      className="flex flex-col gap-2 rounded-lg border border-danger/40 bg-card p-3 text-sm"
    >
      <p className="font-medium text-danger">
        Cannot publish{blocker.code === "worktree_missing" ? " · Workspace unavailable" : ""}
      </p>
      <p className="text-text-secondary">{blocker.message}</p>
      <div className="flex gap-2">
        {blocker.code === "staged_partial" ? (
          <Button
            size="sm"
            render={<Link to="/runs/$runId/files" params={{ runId }} search={{ changes: true }} />}
          >
            Open changes
          </Button>
        ) : null}
        {issueId ? (
          <Button size="sm" render={<Link to="/issues/$issueId" params={{ issueId }} />}>
            Open issue
          </Button>
        ) : null}
        <Button size="sm" render={<Link to="/runs/$runId/logs" params={{ runId }} />}>
          Logs
        </Button>
      </div>
    </section>
  );
}
