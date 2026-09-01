import type { AgentProfileContract } from "@otomat/domain";
import { Button, EmptyState, Icon, Skeleton } from "@otomat/ui";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { AgentProfileDialog } from "@web/components/agents/agent-profile/dialog/agent-profile-dialog";
import { AgentProfileListContent } from "@web/components/agents/agent-profile/list/content";
import { NoProjectSelectedState } from "@web/components/settings/project/no-project-selected-state";
import { SectionHeading } from "@web/components/settings/section-heading";
import { ProjectQueryBoundary } from "@web/components/shell/project-selection/query-boundary";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { useState, type ReactNode } from "react";

export function ProjectAgentsSection() {
  const { projectId, projects } = useSelectedProject();
  const profiles = useAgentProfiles(projectId);
  const runtimes = useRuntimes();
  const [editing, setEditing] = useState<{ profile: AgentProfileContract | null } | null>(null);

  const empty = (
    <EmptyState
      icon="bot"
      variant="inline"
      title="No project agents yet"
      description="Create one to combine your user skills with the skills this repository ships."
    />
  );

  let content: ReactNode;
  if (projects.isPending) {
    content = <Skeleton height={80} />;
  } else if (projectId === undefined) {
    content = <NoProjectSelectedState icon="bot" />;
  } else {
    content = (
      <>
        <div className="mb-4 flex justify-end">
          <Button variant="primary" size="sm" onClick={() => setEditing({ profile: null })}>
            <Icon name="plus" aria-hidden />
            New project agent
          </Button>
        </div>
        <AgentProfileListContent
          profiles={profiles}
          runtimes={runtimes}
          select={(items) => items.filter((profile) => profile.project_id === projectId)}
          empty={empty}
          emptySelection={empty}
          onEdit={(profile) => setEditing({ profile })}
        />
        {editing === null ? null : (
          <AgentProfileDialog
            open
            projectId={projectId}
            onOpenChange={(open) => {
              if (!open) setEditing(null);
            }}
            profile={editing.profile}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <SectionHeading
        title="Project · Agents"
        description="Agents that belong to this project. They may activate your user skills and this repository's own; global agents are limited to user skills."
      />
      <ProjectQueryBoundary query={projects}>{content}</ProjectQueryBoundary>
    </div>
  );
}
