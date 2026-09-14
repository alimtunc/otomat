import type { ActivitySnapshot } from "@otomat/domain";
import { Button, EmptyState } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { ActivityCluster } from "@web/components/shell/activity/cluster";
import { groupActivities } from "@web/components/shell/activity/groups";

export interface ActivityPanelProps {
  snapshot: ActivitySnapshot;
  hostLabel: string;
  onNavigate: () => void;
}

export function ActivityPanel({ snapshot, hostLabel, onNavigate }: ActivityPanelProps) {
  const groups = groupActivities(snapshot.activities).filter(
    (group) => group.bucket === "running" || group.bucket === "queued",
  );
  const attention = snapshot.activities.filter(
    (activity) => activity.bucket === "attention",
  ).length;
  return (
    <div>
      <div className="max-h-100 overflow-auto">
        {groups.length === 0 ? (
          <EmptyState
            icon="activity"
            title="Nothing is working"
            description="Running and queued operations appear here."
          />
        ) : (
          groups.map((group) => (
            <section key={group.bucket} className="pb-1">
              <h3 className="px-2 pb-0.5 pt-1.5 text-micro font-medium uppercase tracking-wide text-text-tertiary">
                {group.label}
              </h3>
              <ul className="flex flex-col">
                {group.clusters.map((cluster) => (
                  <ActivityCluster
                    key={cluster.issue.id}
                    cluster={cluster}
                    hostLabel={hostLabel}
                    onNavigate={onNavigate}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
      <div className="border-t border-border-subtle p-2">
        <Button variant="ghost" size="sm" render={<Link to="/inbox" onClick={onNavigate} />}>
          {attention > 0
            ? `${attention} ${attention === 1 ? "needs" : "need"} you → Inbox`
            : "Open Inbox"}
        </Button>
      </div>
    </div>
  );
}
