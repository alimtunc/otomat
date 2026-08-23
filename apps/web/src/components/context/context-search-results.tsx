import type { ContextReference, IssueContract } from "@otomat/domain";
import { Icon, type IconName } from "@otomat/ui";
import { issueShortId } from "@web/lib/ids";
import type { ReactNode } from "react";

function ResultRow({
  icon,
  onClick,
  children,
}: {
  icon: IconName;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-1.5 truncate rounded-sm px-1.5 py-1 text-left text-xs hover:bg-surface-hover"
    >
      <Icon name={icon} aria-hidden className="shrink-0 text-text-tertiary" />
      {children}
    </button>
  );
}

function Notice({ children, tone }: { children: ReactNode; tone?: "danger" }) {
  return (
    <p className={`px-1.5 text-xs ${tone === "danger" ? "text-danger" : "text-text-tertiary"}`}>
      {children}
    </p>
  );
}

export interface ContextSearchResultsProps {
  issues: readonly IssueContract[];
  paths: readonly string[];
  omittedPaths: number;
  repositoryId: string | null;
  filesFailed: boolean;
  onAdd: (reference: ContextReference) => void;
}

export function ContextSearchResults({
  issues,
  paths,
  omittedPaths,
  repositoryId,
  filesFailed,
  onAdd,
}: ContextSearchResultsProps) {
  return (
    <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
      <section className="flex flex-col gap-0.5">
        <h4 className="px-1.5 text-xs font-semibold uppercase text-text-tertiary">Issues</h4>
        {issues.length === 0 ? <Notice>No loaded issue matches.</Notice> : null}
        {issues.map((issue) => (
          <ResultRow
            key={issue.id}
            icon="list-todo"
            onClick={() => onAdd({ kind: "issue", issue_id: issue.id })}
          >
            <span className="font-medium">{issueShortId(issue)}</span>
            <span className="truncate text-text-secondary">{issue.title}</span>
          </ResultRow>
        ))}
      </section>
      <section className="flex flex-col gap-0.5">
        <h4 className="px-1.5 text-xs font-semibold uppercase text-text-tertiary">Files</h4>
        {repositoryId === null ? <Notice>This project has no repository yet.</Notice> : null}
        {filesFailed ? <Notice tone="danger">Couldn’t read this repository’s files.</Notice> : null}
        {repositoryId !== null && !filesFailed && paths.length === 0 ? (
          <Notice>No tracked file matches.</Notice>
        ) : null}
        {paths.map((path) => (
          <ResultRow key={path} icon="file-text" onClick={() => onAdd({ kind: "file", path })}>
            <span className="truncate">{path}</span>
          </ResultRow>
        ))}
        {omittedPaths === 0 ? null : (
          <Notice>{omittedPaths} further match(es) — narrow the search.</Notice>
        )}
      </section>
    </div>
  );
}
