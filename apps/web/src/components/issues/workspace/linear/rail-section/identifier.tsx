import type { IssueContract } from "@otomat/domain";

export function Identifier({ issue }: { issue: IssueContract }) {
  if (issue.source_identifier === null) return null;
  const label = <span className="font-mono text-micro">{issue.source_identifier}</span>;
  if (issue.source_url === null) return <span className="text-text-tertiary">{label}</span>;
  return (
    <a
      className="text-text-tertiary underline decoration-border-subtle underline-offset-2 hover:text-text-secondary"
      href={issue.source_url}
      rel="noreferrer"
      target="_blank"
    >
      {label}
    </a>
  );
}
