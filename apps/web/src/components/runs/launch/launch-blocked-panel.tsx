import type { IssueContract } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import { LaunchProjectMoveField } from "@web/components/runs/launch/launch-project-move-field";
import type { LaunchTargetBlocker } from "@web/components/runs/launch/use-launch-target";
import { RegisterRepositoryForm } from "@web/components/settings/register-repository-form";

export interface LaunchBlockedPanelProps {
  /** Null when no project is selected, which is the one blocker registration cannot fix. */
  projectId: string | null;
  blocker: LaunchTargetBlocker;
  issue?: IssueContract;
}

const TITLES: Record<LaunchTargetBlocker, string> = {
  daemon_update_pending: "Daemon update pending",
  no_project: "No project selected",
  no_repository: "This project has no repository",
  repository_unavailable: "This project’s repository is unavailable",
};

const DESCRIPTIONS: Record<LaunchTargetBlocker, string> = {
  daemon_update_pending:
    "This host’s daemon runs an older build than the app. New runs are paused so the active runs can finish and the daemon can restart on the new build — that happens automatically once it is idle.",
  no_project: "Pick a project in the sidebar: a run always works in one project’s repository.",
  no_repository:
    "A run works in a dedicated git worktree, so this needs a repository before it can start.",
  repository_unavailable:
    "The registered path is gone or is no longer a git repository, so no worktree can be created from it.",
};

/**
 * Replaces the launch form when no worktree could be created. It offers what
 * actually unblocks the launch — point the issue at a project that is ready, or
 * give this project a repository — instead of failing after the run exists.
 */
export function LaunchBlockedPanel({ projectId, blocker, issue }: LaunchBlockedPanelProps) {
  return (
    <div className="flex flex-col gap-4">
      <EmptyState
        icon="alert-triangle"
        tone="error"
        variant="inline"
        title={TITLES[blocker]}
        description={DESCRIPTIONS[blocker]}
      />
      {issue === undefined || blocker === "daemon_update_pending" ? null : (
        <LaunchProjectMoveField issue={issue} />
      )}
      {projectId === null || blocker === "daemon_update_pending" ? null : (
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <p className="text-xs text-text-tertiary">
            Or register a local repository for this project:
          </p>
          <RegisterRepositoryForm projectId={projectId} />
        </div>
      )}
    </div>
  );
}
