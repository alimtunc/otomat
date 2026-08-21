import type { ActivitySnapshot } from "@otomat/domain";
import { EmptyState } from "@otomat/ui";
import { ActivityCluster } from "@web/components/shell/activity/cluster";
import { groupActivities } from "@web/components/shell/activity/groups";

export interface ActivityPanelProps {
  snapshot: ActivitySnapshot;
  hostLabel: string;
  onNavigate: () => void;
}

export function ActivityPanel({ snapshot, hostLabel, onNavigate }: ActivityPanelProps) {
  const groups = groupActivities(snapshot.activities);
  if (groups.length === 0) {
    return (
      <EmptyState
        icon="activity"
        title="Nothing is working"
        description="Runs and pull-request publications show up here while they work, and stay a while once they finish."
      />
    );
  }
  return (
    <div className="max-h-100 overflow-auto">
      {groups.map((group) => (
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
      ))}
    </div>
  );
}
