import { issueShortId, type ContextReference, type IssueContract } from "@otomat/domain";
import { Icon, Tooltip, TooltipContent, TooltipTrigger, type IconName } from "@otomat/ui";
import type { ComponentPropsWithRef, ReactNode } from "react";

interface ResultRowProps extends Omit<ComponentPropsWithRef<"button">, "className" | "type"> {
  icon: IconName;
}

function ResultRow({ icon, children, ...props }: ResultRowProps) {
  return (
    <button
      type="button"
      className="flex w-full items-center gap-1.5 truncate rounded-sm px-1.5 py-1 text-left text-xs hover:bg-surface-hover"
      {...props}
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
          <Tooltip key={issue.id}>
            <TooltipTrigger
              render={
                <ResultRow
                  icon="list-todo"
                  onClick={() => onAdd({ kind: "issue", issue_id: issue.id })}
                />
              }
            >
              <span className="shrink-0 whitespace-nowrap font-medium tabular-nums">
                {issueShortId(issue)}
              </span>
              <span className="min-w-0 flex-1 truncate text-text-secondary">{issue.title}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-64 whitespace-normal">{issue.title}</TooltipContent>
          </Tooltip>
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
