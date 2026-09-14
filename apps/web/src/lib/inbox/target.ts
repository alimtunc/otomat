import type { InboxEntry } from "@otomat/domain";

export type InboxRoute =
  | { to: "/runs/$runId" | "/runs/$runId/pr" | "/runs/$runId/diff"; params: { runId: string } }
  | {
      to: "/pull-requests/$pullRequestId/diff" | "/pull-requests/$pullRequestId/overview";
      params: { pullRequestId: string };
    };

export function inboxRoute({
  target,
  kind,
}: Pick<InboxEntry, "target"> & Partial<Pick<InboxEntry, "kind">>): InboxRoute {
  if (target.kind === "pull_request") {
    return {
      to: "/pull-requests/$pullRequestId/diff",
      params: { pullRequestId: target.pull_request_id },
    };
  }
  const params = { runId: target.run_id };
  if (target.kind === "run" && kind === "run_review_ready")
    return { to: "/runs/$runId/diff", params };
  return target.kind === "run_pull_request"
    ? { to: "/runs/$runId/pr", params }
    : { to: "/runs/$runId", params };
}
