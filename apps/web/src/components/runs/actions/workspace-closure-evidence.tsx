import type { WorkspaceClosureSummary } from "@otomat/domain";
import type { ReactNode } from "react";

export interface WorkspaceClosureEvidenceProps {
  summary: WorkspaceClosureSummary;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-xs text-text-tertiary">{label}</dt>
      <dd className="m-0 min-w-0 text-xs text-foreground">{children}</dd>
    </>
  );
}

export function WorkspaceClosureEvidence({ summary }: WorkspaceClosureEvidenceProps) {
  const { pull_request: pullRequest } = summary;
  return (
    <div className="flex flex-col gap-3">
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 rounded-lg border border-border-subtle bg-surface-1 p-3">
        <Row label="branch">
          <span className="font-mono">{summary.branch}</span>
          {summary.base_branch ? (
            <span className="text-text-tertiary"> forked from {summary.base_branch}</span>
          ) : null}
        </Row>
        <Row label="worktree">
          {summary.worktree_path ? (
            <span className="font-mono break-all">{summary.worktree_path}</span>
          ) : (
            "already removed from disk"
          )}
        </Row>
        <Row label="commits">
          {summary.commit_count === 1 ? "1 commit" : `${summary.commit_count} commits`}
        </Row>
        <Row label="uncommitted">
          {summary.uncommitted_files === 0
            ? "nothing uncommitted"
            : `${summary.uncommitted_files} file(s) not committed`}
        </Row>
        <Row label="diff">
          {`${summary.changed_files} file(s) changed, +${summary.additions} −${summary.deletions}`}
        </Row>
        <Row label="pull request">
          {pullRequest?.url ? (
            <a
              href={pullRequest.url}
              target="_blank"
              rel="noreferrer"
              className="text-iris-text underline"
            >
              #{pullRequest.number} ({pullRequest.status})
            </a>
          ) : (
            "none"
          )}
        </Row>
      </dl>
      {summary.commits.length > 0 ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0">
          {summary.commits.map((commit) => (
            <li key={commit.sha} className="flex min-w-0 gap-2 text-xs">
              <span className="font-mono text-text-tertiary">{commit.sha.slice(0, 8)}</span>
              <span className="min-w-0 truncate text-foreground">{commit.subject}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
