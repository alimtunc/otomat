import { Button, buttonVariants, cn } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useProjects } from "@web/api/daemon/queries";
import { useIssueSources } from "@web/api/linear/queries";
import { AddProjectDialog } from "@web/components/shell/project-selection/add-project-dialog";
import { selectableProjects } from "@web/components/shell/project-selection/selection";
import { useProjectSwitcher } from "@web/components/shell/project-selection/use-project-switcher";
import { useState } from "react";

/**
 * A key alone imports nothing, and ownership stays with the active host:
 * connecting one never creates or feeds a project in another daemon's database.
 */
export function LinearOnboardingPanel({ workspaceId }: { workspaceId: string }) {
  const projects = useProjects();
  const sources = useIssueSources(workspaceId);
  const switcher = useProjectSwitcher();
  const [addProjectOpen, setAddProjectOpen] = useState(false);

  if (!projects.isSuccess || !sources.isSuccess) return null;
  const hostProjects = selectableProjects(projects.data);
  const mapped = new Set(sources.data.map((source) => source.project_id));
  if (hostProjects.some((project) => mapped.has(project.id))) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card px-3 py-2.5">
      {hostProjects.length === 0 ? (
        <>
          <p className="text-sm text-foreground">No project on this host yet</p>
          <p className="text-xs text-text-tertiary">
            Otomat imports issues into a project. Add the repository you want to work on, then map a
            Linear team onto it.
          </p>
          <div>
            <Button variant="primary" size="sm" onClick={() => setAddProjectOpen(true)}>
              Add project
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm text-foreground">No Linear team mapped yet</p>
          <p className="text-xs text-text-tertiary">
            Nothing is imported until you choose the team or Linear project whose issues belong to
            this project — Otomat never guesses one. The first import starts as soon as you map it.
          </p>
          <div>
            <Link
              to="/settings/project"
              className={cn(buttonVariants({ variant: "primary", size: "sm" }))}
            >
              Map a Linear team
            </Link>
          </div>
        </>
      )}
      <AddProjectDialog
        open={addProjectOpen}
        onOpenChange={setAddProjectOpen}
        hosts={switcher.hostOptions}
        onSelect={switcher.selectProject}
      />
    </div>
  );
}
