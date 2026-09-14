import {
  NOTIFICATION_HEADLINES,
  RUN_NOTIFICATION_CATEGORY,
  type ActivityBucket,
  type ActivityContract,
} from "@otomat/domain";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useActivity } from "@web/api/activity/queries";
import { activityTarget } from "@web/components/shell/activity/target";
import {
  CATEGORY_TOAST,
  type NotificationToast,
} from "@web/components/shell/notifications/category-toast";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { useEffect, useRef } from "react";

const ANNOUNCED: ReadonlySet<ActivityBucket> = new Set<ActivityBucket>(["attention", "recent"]);

function notice(activity: ActivityContract): { message: string; notify: NotificationToast } | null {
  const subject = activity.issue.identifier ?? activity.issue.title;
  if (activity.kind !== "run") {
    return activity.bucket === "recent"
      ? { message: `Pull request published — ${subject}`, notify: CATEGORY_TOAST.completed }
      : { message: `Publication stopped — ${subject}`, notify: CATEGORY_TOAST.blocked };
  }
  const category = RUN_NOTIFICATION_CATEGORY[activity.status];
  if (category === null) return null;
  return {
    message: `${NOTIFICATION_HEADLINES[category]} — ${subject}`,
    notify: CATEGORY_TOAST[category],
  };
}

export function useActivityNotices(): void {
  const activities = useActivity().data?.activities ?? [];
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const seen = useRef<Map<string, ActivityBucket> | null>(null);

  // otomat-allow-effect: the daemon settling work off-screen is an external transition, not a render result.
  useEffect(() => {
    if (desktopBridge() !== null) return;
    const previous = seen.current;
    seen.current = new Map(activities.map((activity) => [activity.id, activity.bucket]));
    if (previous === null) return;
    for (const activity of activities) {
      const before = previous.get(activity.id);
      if (before === undefined || before === activity.bucket) continue;
      if (!ANNOUNCED.has(activity.bucket)) continue;
      const target = activityTarget(activity);
      if (pathname === target.pathname || pathname.startsWith(`${target.pathname}/`)) continue;
      const announced = notice(activity);
      if (announced === null) continue;
      const open = () => void navigate({ to: target.to, params: target.params });
      announced.notify(announced.message, { action: { label: "Open", onClick: open } });
    }
  }, [activities, pathname, navigate]);
}
