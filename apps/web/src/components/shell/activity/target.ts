import type { ActivityContract } from "@otomat/domain";

export interface ActivityTarget {
  to: "/runs/$runId" | "/runs/$runId/pr";
  params: { runId: string };
  pathname: string;
}

export function activityTarget(activity: ActivityContract): ActivityTarget {
  const params = { runId: activity.run_id };
  if (activity.kind === "pull_request_publication") {
    return { to: "/runs/$runId/pr", params, pathname: `/runs/${activity.run_id}/pr` };
  }
  return { to: "/runs/$runId", params, pathname: `/runs/${activity.run_id}` };
}
