import { shortId } from "@web/lib/ids";

interface BackTarget {
  href: string;
  label: string;
}

const RUN_TAB_ROUTE = /^\/runs\/([^/]+)\/[^/]+$/;
const RUN_ROUTE = /^\/runs\/[^/]+$/;
const ISSUE_ROUTE = /^\/issues\/[^/]+$/;
const AGENT_PROFILE_ROUTE = /^\/settings\/agents\/[^/]+$/;
const PULL_REQUEST_ROUTE = /^\/pull-requests\/[^/]+\/[^/]+$/;

export function backTarget(pathname: string, linkedIssueId: string | null): BackTarget | null {
  const tab = RUN_TAB_ROUTE.exec(pathname);
  if (tab !== null) {
    const runId = tab[1];
    return { href: `/runs/${runId}`, label: `run ${shortId(runId)}` };
  }
  if (RUN_ROUTE.test(pathname)) {
    if (linkedIssueId === null) return { href: "/runs", label: "Runs" };
    return { href: `/issues/${linkedIssueId}`, label: `issue ${shortId(linkedIssueId)}` };
  }
  if (ISSUE_ROUTE.test(pathname)) return { href: "/issues", label: "Issues" };
  if (AGENT_PROFILE_ROUTE.test(pathname)) return { href: "/settings/agents", label: "Agents" };
  if (PULL_REQUEST_ROUTE.test(pathname)) return { href: "/reviews", label: "Reviews" };
  return null;
}
