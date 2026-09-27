import { useQuery } from "@tanstack/react-query";
import { useParams, useRouterState, useSearch } from "@tanstack/react-router";
import { useConversations } from "@web/api/conversations/queries";
import { useInbox } from "@web/api/inbox/queries";
import { issueOptions } from "@web/api/issues/queries";
import { pullRequestReviewContextOptions } from "@web/api/prs/queries";
import { runDetailOptions } from "@web/api/runs/queries";
import { useQueryKeys } from "@web/api/use-query-keys";
import { sectionForPath, WORKSPACE_NAV } from "@web/components/shell/nav-items";
import { projectSwitcherKey } from "@web/components/shell/project-selection/host-key";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { useActiveHostId } from "@web/lib/active-host";

import { deskOwner } from "./owner";
import { isDeskRoute } from "./state";

export function useDeskRoute() {
  const { runId, issueId, pullRequestId } = useParams({ strict: false });
  const search = useSearch({ strict: false });
  const location = useRouterState({ select: (state) => state.location });
  const host = useActiveHostId();
  const keys = useQueryKeys();
  const selected = useSelectedProject();
  const conversationRun = location.pathname === "/conversations" ? search.run : undefined;
  const terminal = location.pathname === "/conversations" ? search.terminal : undefined;
  const run = runId ?? conversationRun;
  const detail = useQuery({ ...runDetailOptions(keys, run ?? ""), enabled: run !== undefined });
  const pr = useQuery({
    ...pullRequestReviewContextOptions(keys, pullRequestId ?? ""),
    enabled: pullRequestId !== undefined,
  });
  const issue = useQuery(
    issueOptions(
      keys,
      issueId ?? detail.data?.run.issue_id ?? pr.data?.pull_request.issue_id ?? null,
    ),
  );
  const conversations = useConversations();
  const inbox = useInbox();
  const owner = deskOwner({
    issueId,
    run,
    terminal,
    pullRequestId,
    selectedProjectId: selected.projectId,
    sectionLabel: WORKSPACE_NAV.find((item) => item.section === sectionForPath(location.pathname))
      ?.label,
    issue: issue.data,
    pullRequest: pr.data?.pull_request,
    entry: conversations.data?.entries.find((candidate) =>
      "terminal" in candidate
        ? terminal !== undefined && candidate.terminal.id === terminal
        : conversationRun !== undefined &&
          candidate.run_id === conversationRun &&
          candidate.step_run_id === search.step,
    ),
    reviewOwner: inbox.data?.entries.find(
      (candidate) =>
        candidate.target.kind === "pull_request" &&
        candidate.target.pull_request_id === pullRequestId,
    )?.project.id,
  });
  return {
    key: owner.projectId === undefined ? undefined : projectSwitcherKey(host, owner.projectId),
    projectId: owner.projectId,
    host,
    href: location.href,
    label: owner.label,
    scoped: isDeskRoute(location.href),
  };
}
