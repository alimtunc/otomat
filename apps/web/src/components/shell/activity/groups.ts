import { ACTIVITY_BUCKETS, type ActivityBucket, type ActivityContract } from "@otomat/domain";

const BUCKET_LABELS = {
  running: "Running",
  queued: "Queued & waiting",
  attention: "Needs attention",
  recent: "Recently completed",
} satisfies Record<ActivityBucket, string>;

export interface ActivityIssueCluster {
  issue: ActivityContract["issue"];
  project: ActivityContract["project"];
  activities: ActivityContract[];
}

export interface ActivityGroup {
  bucket: ActivityBucket;
  label: string;
  clusters: ActivityIssueCluster[];
}

function clusterByIssue(activities: ActivityContract[]): ActivityIssueCluster[] {
  const clusters = new Map<string, ActivityIssueCluster>();
  for (const activity of activities) {
    const cluster = clusters.get(activity.issue.id) ?? {
      issue: activity.issue,
      project: activity.project,
      activities: [],
    };
    cluster.activities.push(activity);
    clusters.set(activity.issue.id, cluster);
  }
  return [...clusters.values()];
}

/** Buckets in panel order, empty ones dropped so no heading stands over nothing. */
export function groupActivities(activities: ActivityContract[]): ActivityGroup[] {
  return ACTIVITY_BUCKETS.map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    clusters: clusterByIssue(activities.filter((activity) => activity.bucket === bucket)),
  })).filter((group) => group.clusters.length > 0);
}

/** What the badge counts: every action still in flight, waiting, or asking for the operator. */
export function countPendingActivities(activities: ActivityContract[]): number {
  return activities.filter((activity) => activity.bucket !== "recent").length;
}
