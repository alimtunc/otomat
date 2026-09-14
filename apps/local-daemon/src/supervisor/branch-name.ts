import { COMMIT_TYPES } from "@otomat/domain";

import type { ContextIssueRow } from "#context";
import { sanitizeBranchName } from "#git";

const BRANCH_TYPES = [...COMMIT_TYPES, "hotfix", "release"] as const;

function branchType(raw: string | undefined) {
  const value = raw
    ?.trim()
    .toLowerCase()
    .replace(/^type[/:]\s*/, "");
  if (value === "bug" || value === "bugfix") return "fix";
  if (value === "feature" || value === "enhancement") return "feat";
  return BRANCH_TYPES.find((type) => type === value);
}

export function issueBranchName(
  issue: Pick<ContextIssueRow, "title" | "source_labels" | "source_identifier">,
  runId: string,
): string {
  const title = issue.title.trim();
  const prefix =
    /^(?:\[([a-z]+)\]|([a-z]+)(?:\([^()]+\))?!?[:/]|(fix|hotfix|bug)\b)\s*[: -]*/i.exec(title);
  const titleType = branchType(prefix?.[1] ?? prefix?.[2] ?? prefix?.[3]);
  const labelType = issue.source_labels?.map((label) => branchType(label.name)).find(Boolean);
  const type = titleType ?? labelType ?? "feat";
  const summary = titleType && prefix ? title.slice(prefix[0].length) : title;
  const slug = sanitizeBranchName(summary.replaceAll("/", "-"));
  const fallback = sanitizeBranchName(issue.source_identifier ?? "") ?? `task-${runId.slice(0, 8)}`;
  return sanitizeBranchName(`${type}/${slug ?? fallback}`) ?? `${type}/${fallback}`;
}
