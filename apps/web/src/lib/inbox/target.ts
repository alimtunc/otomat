import type { InboxTarget } from "@otomat/domain";

export type InboxRoute =
  | { to: "/runs/$runId" | "/runs/$runId/pr"; params: { runId: string } }
  | { to: "/pull-requests/$pullRequestId/diff"; params: { pullRequestId: string } };

export function inboxRoute(target: InboxTarget): InboxRoute {
  if (target.kind === "pull_request") {
    return {
      to: "/pull-requests/$pullRequestId/diff",
      params: { pullRequestId: target.pull_request_id },
    };
  }
  const params = { runId: target.run_id };
  return target.kind === "run_pull_request"
    ? { to: "/runs/$runId/pr", params }
    : { to: "/runs/$runId", params };
}
