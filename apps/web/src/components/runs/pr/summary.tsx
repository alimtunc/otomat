import type { PullRequestPublicationMode, PullRequestPublishability } from "@otomat/domain";
import { Chip, MetaList, type MetaListItem } from "@otomat/ui";

export interface PullRequestSummaryProps {
  publishability: PullRequestPublishability;
  mode: PullRequestPublicationMode;
  issueTitle: string;
}

function diffLabel(publishability: PullRequestPublishability): string {
  const { changed_files, additions, deletions } = publishability;
  const files = `${String(changed_files)} file${changed_files === 1 ? "" : "s"}`;
  return `${files} · +${String(additions)} −${String(deletions)}`;
}

/** Read from the repository's own history, and shown because it is what the generated title must satisfy. */
function commitLabel(publishability: PullRequestPublishability): string {
  const convention =
    publishability.convention === "conventional" ? "Conventional Commits" : "no set convention";
  return publishability.dirty ? `${convention} · commits uncommitted work` : convention;
}

export function PullRequestSummary({ publishability, mode, issueTitle }: PullRequestSummaryProps) {
  const items: MetaListItem[] = [
    { key: "issue", label: "Issue", value: <span className="truncate">{issueTitle}</span> },
    {
      key: "branch",
      label: "Source",
      value: <Chip tone="ghost">{publishability.head_ref ?? "no workspace"}</Chip>,
    },
    {
      key: "destination",
      label: "Destination",
      value: (
        <span className="text-text-secondary">
          {publishability.repository ?? "no GitHub remote"}
          {publishability.base_ref === null ? "" : ` · ${publishability.base_ref}`}
        </span>
      ),
    },
    { key: "diff", label: "Changes", value: <span>{diffLabel(publishability)}</span> },
    {
      key: "convention",
      label: "Commit",
      value: <span className="text-text-secondary">{commitLabel(publishability)}</span>,
    },
    {
      key: "mode",
      label: "Publication",
      value: <Chip>{mode === "draft" ? "Draft" : "Ready for review"}</Chip>,
    },
  ];
  return <MetaList items={items} />;
}
