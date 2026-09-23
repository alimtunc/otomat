import { countWorkspaces, type WorkspaceState } from "@otomat/domain";
import { Button, Icon, Input, Popover, PopoverContent, PopoverTrigger, Skeleton } from "@otomat/ui";
import { useForm, useStore } from "@tanstack/react-form";
import { useProjectWorkspaces } from "@web/api/workspaces/queries";
import { SectionHeading } from "@web/components/settings/section-heading";
import { AutoDeleteWorkspacesRow } from "@web/components/settings/workspaces/auto-delete-row";
import { WorkspaceCounters } from "@web/components/settings/workspaces/counters";
import { WorkspaceHostGroup } from "@web/components/settings/workspaces/host-group";
import { NoProjectSelectedState } from "@web/components/shell/project-selection/no-project-selected-state";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { useHostSnapshot } from "@web/components/shell/remote-session/use-host-snapshot";
import { useActiveHostDescriptor } from "@web/lib/active-host";
import { DEFAULT_WORKSPACES_FILTER } from "@web/lib/workspace/filter";
import { useState, type ReactNode } from "react";

export function WorkspacesSection() {
  const { projectId, projects } = useSelectedProject();
  const host = useActiveHostDescriptor();
  const snapshot = useHostSnapshot();
  const workspaces = useProjectWorkspaces(projectId);
  const [states, setStates] = useState(DEFAULT_WORKSPACES_FILTER.states);
  const form = useForm({ defaultValues: { search: "" } });
  const search = useStore(form.store, (state) => state.values.search);
  const filter = { states, search };
  const toggleState = (state: WorkspaceState): void => {
    setStates((current) =>
      current.includes(state) ? current.filter((kept) => kept !== state) : [...current, state],
    );
  };

  let content: ReactNode;
  if (projects.isPending) {
    content = <Skeleton height={160} />;
  } else if (projectId === undefined) {
    content = <NoProjectSelectedState icon="layers" />;
  } else {
    content = (
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border-subtle bg-card px-4">
          <AutoDeleteWorkspacesRow projectId={projectId} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {workspaces.isPending ? (
            <Skeleton height={22} width={320} />
          ) : (
            <WorkspaceCounters
              counts={countWorkspaces(workspaces.data?.entries ?? [])}
              selected={filter.states}
              onToggle={toggleState}
            />
          )}
          <form.Field name="search">
            {(field) => (
              <Input
                value={field.state.value}
                icon={<Icon name="search" aria-hidden />}
                placeholder="Search issue, branch, path or host"
                aria-label="Search workspaces"
                className="min-w-44 flex-1"
                onChange={(event) => field.handleChange(event.target.value)}
                onBlur={field.handleBlur}
              />
            )}
          </form.Field>
        </div>
        <WorkspaceHostGroup
          host={host}
          status={host.kind === "local" ? null : (snapshot.data?.remote_status ?? null)}
          inventory={workspaces}
          filter={filter}
        />
      </div>
    );
  }

  return (
    <div>
      <SectionHeading title="Workspaces" description="Worktrees this project holds on its host." />
      <Popover>
        <PopoverTrigger
          render={
            <Button size="xs" variant="ghost" className="mb-3">
              How cleanup works
            </Button>
          }
        />
        <PopoverContent className="max-w-sm p-3 text-xs">
          Each repository is one project on one host. A worktree goes when its merged pull request
          closes the cycle with auto-delete on, or when you confirm a deletion here.
        </PopoverContent>
      </Popover>
      <ProjectQueryBoundary query={projects}>{content}</ProjectQueryBoundary>
    </div>
  );
}
