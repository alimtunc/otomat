import { Button, ErrorState, Skeleton } from "@otomat/ui";
import { RepositoryHostGroup } from "@web/components/settings/repositories/host-group";
import { useHostRepositories } from "@web/components/settings/repositories/use-host-repositories";
import { SectionHeading } from "@web/components/settings/section-heading";
import { AddProjectDialog } from "@web/components/shell/project-selection/add-project-dialog";
import { useProjectSwitcher } from "@web/components/shell/project-selection/use-project-switcher";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { useState } from "react";

export function RepositoriesSection() {
  const hosts = useHostRepositories();
  const switcher = useProjectSwitcher();
  const [adding, setAdding] = useState(false);

  return (
    <div>
      <SectionHeading
        title="Repositories"
        description="Each repository is one project on one execution host. Otomat forks its worktrees on that host and nowhere else."
      />
      <div className="flex flex-col gap-5">
        <div>
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            Add repository
          </Button>
        </div>
        <QueryBoundary
          query={hosts}
          pending={<Skeleton height={120} />}
          error={
            <ErrorState
              variant="inline"
              title="Couldn’t load the hosts’ repositories"
              onRetry={() => void hosts.refetch()}
            />
          }
        >
          {(entries) =>
            entries.map((entry) => <RepositoryHostGroup key={entry.host.id} entry={entry} />)
          }
        </QueryBoundary>
      </div>
      <AddProjectDialog
        open={adding}
        onOpenChange={setAdding}
        hosts={switcher.hostOptions}
        onSelect={switcher.selectProject}
      />
    </div>
  );
}
