import type { ActivityBucket, ActivityContract } from "@otomat/domain";
import { toast } from "@otomat/ui";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useActivity } from "@web/api/activity/queries";
import { activityTarget } from "@web/components/shell/activity/target";
import { useEffect, useRef } from "react";

/** Buckets worth interrupting for: work that stopped, one way or the other. */
const ANNOUNCED: ReadonlySet<ActivityBucket> = new Set<ActivityBucket>(["attention", "recent"]);

function headline(activity: ActivityContract): string {
  const subject = activity.issue.identifier ?? activity.issue.title;
  if (activity.kind === "run") {
    return activity.bucket === "recent"
      ? `Run finished — ${subject}`
      : `Run needs you — ${subject}`;
  }
  return activity.bucket === "recent"
    ? `Pull request published — ${subject}`
    : `Publication stopped — ${subject}`;
}

/** Announces work that stopped while the operator was elsewhere; the first snapshot only seeds, so opening the app never replays yesterday as news. */
export function useActivityNotices(): void {
  const activities = useActivity().data?.activities ?? [];
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const seen = useRef<Map<string, ActivityBucket> | null>(null);

  // otomat-allow-effect: the daemon settling work off-screen is an external transition, not a render result.
  useEffect(() => {
    const previous = seen.current;
    seen.current = new Map(activities.map((activity) => [activity.id, activity.bucket]));
    if (previous === null) return;
    for (const activity of activities) {
      const before = previous.get(activity.id);
      if (before === undefined || before === activity.bucket) continue;
      if (!ANNOUNCED.has(activity.bucket)) continue;
      const target = activityTarget(activity);
      if (pathname === target.pathname || pathname.startsWith(`${target.pathname}/`)) continue;
      const open = () => void navigate({ to: target.to, params: target.params });
      const notify = activity.bucket === "recent" ? toast.success : toast.error;
      notify(headline(activity), { action: { label: "Open", onClick: open } });
    }
  }, [activities, pathname, navigate]);
}
