import type { ActivityIssueCluster } from "@web/components/shell/activity/groups";
import { ActivityRow } from "@web/components/shell/activity/row";

export interface ActivityClusterProps {
  cluster: ActivityIssueCluster;
  hostLabel: string;
  onNavigate: () => void;
}

export function ActivityCluster({ cluster, hostLabel, onNavigate }: ActivityClusterProps) {
  return (
    <li className="px-2 py-1">
      <p className="flex items-baseline gap-1.5">
        <span className="truncate text-sm font-medium text-foreground">
          {cluster.issue.identifier ?? cluster.issue.title}
        </span>
        <span className="truncate text-micro text-text-tertiary">
          {cluster.project.name} · {hostLabel}
        </span>
      </p>
      <ul className="flex flex-col">
        {cluster.activities.map((activity) => (
          <ActivityRow key={activity.id} activity={activity} onNavigate={onNavigate} />
        ))}
      </ul>
    </li>
  );
}
