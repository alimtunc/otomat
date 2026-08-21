import type { ActivityContract } from "@otomat/domain";

export interface ActivityTarget {
  to: "/runs/$runId" | "/runs/$runId/pr";
  params: { runId: string };
  /** The resolved path, so a caller can tell whether the operator is already looking at this surface. */
  pathname: string;
}

/** Where an activity's canonical surface is; a publication owns the run's pull-request panel, where its retry lives. */
export function activityTarget(activity: ActivityContract): ActivityTarget {
  const params = { runId: activity.run_id };
  if (activity.kind === "pull_request_publication") {
    return { to: "/runs/$runId/pr", params, pathname: `/runs/${activity.run_id}/pr` };
  }
  return { to: "/runs/$runId", params, pathname: `/runs/${activity.run_id}` };
}
