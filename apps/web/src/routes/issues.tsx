import { EmptyState } from "@otomat/ui";
import { Inbox } from "lucide-react";

import { RouteShell } from "./shell";

export function IssuesRoute() {
  return (
    <RouteShell active="issues" breadcrumbs={[{ label: "Issues", current: true }]}>
      <div className="grid h-full place-items-center p-6">
        <EmptyState
          icon={Inbox}
          title="No issues yet"
          description="Connect a local daemon to load issues and launch runs. Daemon connectivity arrives in OTO-9."
        />
      </div>
    </RouteShell>
  );
}
