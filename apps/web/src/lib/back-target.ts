import { shortId } from "@web/lib/ids";

interface BackTarget {
  href: string;
  label: string;
}

const RUN_TAB_ROUTE = /^\/runs\/([^/]+)\/[^/]+$/;
const RUN_ROUTE = /^\/runs\/[^/]+$/;
const ISSUE_ROUTE = /^\/issues\/[^/]+$/;
const AGENT_ROUTE = /^\/agents\/[^/]+$/;

/** `null` means `pathname` is not a detail view, so it owns no Back control. */
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
  if (AGENT_ROUTE.test(pathname)) return { href: "/agents", label: "Agents" };
  return null;
}
