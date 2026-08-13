import type { ContextFileRefusal, SessionContext } from "@otomat/domain";
import { Markdown } from "@otomat/ui";
import type { ReactNode } from "react";

const FILE_REFUSAL_LABEL: Record<ContextFileRefusal, string> = {
  missing: "not in this snapshot",
  binary: "binary",
  too_large: "past the size limit",
  outside_repository: "not repository-relative",
  symlink: "a symlink, refused",
  unreadable: "unreadable",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-tertiary">{title}</h3>
      {children}
    </section>
  );
}

export interface SessionContextSectionsProps {
  context: SessionContext;
}

/** The dossier a session was given, shown as it was frozen: nothing here is re-read live. */
export function SessionContextSections({ context }: SessionContextSectionsProps) {
  const { selection, workspace, pull_request: pullRequest, progress } = context;
  return (
    <div className="flex flex-col gap-3 text-sm">
      {selection.issue === null ? null : (
        <Section title="Issue">
          <p className="font-medium">
            {selection.issue.identifier === null
              ? selection.issue.title
              : `${selection.issue.identifier} — ${selection.issue.title}`}
          </p>
          <Markdown value={selection.issue.body ?? "_No description._"} />
        </Section>
      )}
      {selection.issues.length === 0 ? null : (
        <Section title="Referenced issues">
          <ul className="list-disc pl-4 text-xs">
            {selection.issues.map((issue) => (
              <li key={issue.id}>
                {issue.identifier ?? issue.id} — {issue.title}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {selection.files.length === 0 ? null : (
        <Section title="Files">
          <ul className="list-disc pl-4 text-xs">
            {selection.files.map((file) => (
              <li key={file.path}>
                <span className="font-mono">{file.path}</span>{" "}
                <span className="text-text-tertiary">
                  {file.state === "read" ? `${file.bytes} bytes` : FILE_REFUSAL_LABEL[file.reason]}
                </span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {selection.review_comments.length === 0 ? null : (
        <Section title="Review comments">
          <ul className="list-disc pl-4 text-xs">
            {selection.review_comments.map((comment) => (
              <li key={comment.id}>
                <span className="font-mono">
                  {comment.file_path}
                  {comment.line === null ? "" : `:${comment.line}`}
                </span>{" "}
                — {comment.body}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {workspace === null ? null : (
        <Section title="Workspace">
          <ul className="text-xs text-text-secondary">
            <li>host: {workspace.host}</li>
            <li>repository: {workspace.repository}</li>
            <li>branch: {workspace.branch}</li>
            <li>uncommitted files: {workspace.uncommitted_files}</li>
            <li>
              diff:{" "}
              {workspace.diff === null
                ? "unavailable"
                : `${workspace.diff.files.length} file(s) +${workspace.diff.additions} -${workspace.diff.deletions}`}
            </li>
          </ul>
        </Section>
      )}
      {pullRequest === null ? null : (
        <Section title="Pull request">
          <p className="text-xs text-text-secondary">
            #{pullRequest.number} {pullRequest.title} ({pullRequest.state}) —{" "}
            {pullRequest.head_branch} → {pullRequest.base_branch}
          </p>
        </Section>
      )}
      {progress === null ? null : (
        <Section title="Plan progress">
          <ul className="text-xs text-text-secondary">
            {progress.steps.map((step) => (
              <li key={step.id}>
                {step.name}: {step.status}
                {step.current ? " — this session" : ""}
                {step.dependency ? " — dependency" : ""}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {selection.note === null || selection.note.trim() === "" ? null : (
        <Section title="Step instructions">
          <p className="whitespace-pre-wrap text-xs">{selection.note}</p>
        </Section>
      )}
    </div>
  );
}
