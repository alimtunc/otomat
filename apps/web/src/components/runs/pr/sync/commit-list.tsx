import type { PullRequestCommit } from "@otomat/domain";

export interface PullRequestCommitListProps {
  label: string;
  commits: PullRequestCommit[];
}

const SHOWN = 5;

export function PullRequestCommitList({ label, commits }: PullRequestCommitListProps) {
  if (commits.length === 0) return null;
  const hidden = commits.length - SHOWN;
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 text-xs font-medium text-text-secondary">{label}</p>
      <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
        {commits.slice(0, SHOWN).map((commit) => (
          <li key={commit.sha} className="flex min-w-0 items-baseline gap-2 text-xs">
            <code className="shrink-0 font-mono text-text-tertiary">{commit.sha.slice(0, 7)}</code>
            <span className="truncate text-text-secondary">{commit.subject}</span>
          </li>
        ))}
      </ul>
      {hidden > 0 ? <p className="m-0 text-xs text-text-tertiary">and {hidden} more</p> : null}
    </div>
  );
}
