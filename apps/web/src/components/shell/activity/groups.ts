import { ACTIVITY_BUCKETS, type ActivityBucket, type ActivityContract } from "@otomat/domain";

const BUCKET_LABELS = {
  running: "Running",
  queued: "Queued & waiting",
  attention: "Needs attention",
  recent: "Recently completed",
} satisfies Record<ActivityBucket, string>;

export interface ActivityGroup {
  bucket: ActivityBucket;
  label: string;
  activities: ActivityContract[];
}

/** Buckets in panel order, empty ones dropped so no heading stands over nothing. */
export function groupActivities(activities: ActivityContract[]): ActivityGroup[] {
  return ACTIVITY_BUCKETS.map((bucket) => ({
    bucket,
    label: BUCKET_LABELS[bucket],
    activities: activities.filter((activity) => activity.bucket === bucket),
  })).filter((group) => group.activities.length > 0);
}

/** What the badge counts: work still in flight, waiting, or asking for the operator. */
export function countPendingActivities(activities: ActivityContract[]): number {
  return activities.filter((activity) => activity.bucket !== "recent").length;
}
