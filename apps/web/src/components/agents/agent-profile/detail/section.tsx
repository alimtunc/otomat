import { ErrorState } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { useSkills } from "@web/api/skills/queries";
import { AgentProfileDetail } from "@web/components/agents/agent-profile/detail/content";
import { AgentProfileNotFoundState } from "@web/components/agents/agent-profile/detail/not-found-state";
import { AgentProfileDetailSkeleton } from "@web/components/agents/agent-profile/detail/skeleton";
import { useSelectedProject } from "@web/components/shell/project-selection/use-selected";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { QueryList } from "@web/components/shell/query-list";

const retry = (title: string, refetch: () => void) => (
  <ErrorState variant="inline" title={title} onRetry={refetch} />
);

export function AgentProfileSection() {
  const { profileId } = useParams({ from: "/settings/agents/$profileId" });
  const { projectId } = useSelectedProject();
  const profiles = useAgentProfiles(projectId);
  const runtimes = useRuntimes();
  const skills = useSkills();
  const profile = profiles.data?.find((candidate) => candidate.id === profileId);

  return (
    <QueryList
      query={profiles}
      pending={<AgentProfileDetailSkeleton />}
      error={retry("Couldn’t load the agent profile", () => void profiles.refetch())}
      empty={<AgentProfileNotFoundState />}
    >
      {() =>
        profile === undefined ? (
          <AgentProfileNotFoundState />
        ) : (
          <QueryBoundary
            query={runtimes}
            pending={<AgentProfileDetailSkeleton />}
            error={retry("Couldn’t load runtimes", () => void runtimes.refetch())}
          >
            {(descriptors) => (
              <QueryBoundary
                query={skills}
                pending={<AgentProfileDetailSkeleton />}
                error={retry("Couldn’t load the skill catalog", () => void skills.refetch())}
              >
                {(catalog) => (
                  <AgentProfileDetail
                    profile={profile}
                    descriptors={descriptors}
                    skills={catalog}
                  />
                )}
              </QueryBoundary>
            )}
          </QueryBoundary>
        )
      }
    </QueryList>
  );
}
