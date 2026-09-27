import { useQuery } from "@tanstack/react-query";
import { useParams, useRouterState, useSearch } from "@tanstack/react-router";
import { useConversations } from "@web/api/conversations/queries";
import { useInbox } from "@web/api/inbox/queries";
import { issueOptions } from "@web/api/issues/queries";
import { pullRequestReviewContextOptions } from "@web/api/prs/queries";
import { runDetailOptions } from "@web/api/runs/queries";
import { useQueryKeys } from "@web/api/use-query-keys";
import { WORKSPACE_NAV } from "@web/components/shell/nav-items";
import { projectSwitcherKey } from "@web/components/shell/project-selection/host-key";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { useActiveHostId } from "@web/lib/active-host";
import { conversationTitle } from "@web/lib/conversations/title";

import { isDeskRoute } from "./state";

export function useDeskRoute() {
  const { runId, issueId, pullRequestId } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const location = useRouterState({ select: (state) => state.location });
  const host = useActiveHostId();
  const keys = useQueryKeys();
  const selected = useSelectedProject();
  const conversationRun = location.pathname === "/conversations" ? search.run : undefined;
  const conversationTerminal = location.pathname === "/conversations" ? search.terminal : undefined;
  const run = runId ?? conversationRun;
  const detail = useQuery({ ...runDetailOptions(keys, run ?? ""), enabled: run !== undefined });
  const pr = useQuery({
    ...pullRequestReviewContextOptions(keys, pullRequestId ?? ""),
    enabled: pullRequestId !== undefined,
  });
  const ownerIssueId =
    issueId ?? detail.data?.run.issue_id ?? pr.data?.pull_request.issue_id ?? null;
  const issue = useQuery(issueOptions(keys, ownerIssueId));
  const conversations = useConversations();
  const inbox = useInbox();
  const reviewOwner = inbox.data?.entries.find(
    (candidate) =>
      candidate.target.kind === "pull_request" &&
      candidate.target.pull_request_id === pullRequestId,
  )?.project.id;
  const entry = conversations.data?.entries.find((candidate) =>
    "terminal" in candidate
      ? conversationTerminal !== undefined && candidate.terminal.id === conversationTerminal
      : conversationRun !== undefined &&
        candidate.run_id === conversationRun &&
        candidate.step_run_id === search.step,
  );
  const section = WORKSPACE_NAV.find(
    (item) => location.pathname === item.to || location.pathname.startsWith(`${item.to}/`),
  );
  let projectId = selected.projectId;
  let label = section?.label ?? "Project";
  if (issueId !== undefined) {
    projectId = issue.data?.project_id;
    label = issue.data?.title ?? "Issue";
  } else if (conversationTerminal !== undefined) {
    projectId = entry?.project.id;
    label = entry === undefined ? "Terminal" : conversationTitle(entry);
  } else if (run !== undefined) {
    projectId = entry?.project.id ?? issue.data?.project_id;
    label =
      entry === undefined
        ? (issue.data?.title ?? `Run · ${run.slice(0, 8)}`)
        : conversationTitle(entry);
  } else if (pullRequestId !== undefined) {
    projectId =
      ownerIssueId === null ? (reviewOwner ?? selected.projectId) : issue.data?.project_id;
    label = pr.data?.pull_request.title ?? "Review";
  }
  return {
    key: projectId === undefined ? undefined : projectSwitcherKey(host, projectId),
    projectId,
    host,
    href: location.href,
    label,
    scoped: isDeskRoute(location.href),
  };
}
