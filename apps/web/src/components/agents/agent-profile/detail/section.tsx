import { ErrorState } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { AgentProfileDetail } from "@web/components/agents/agent-profile/detail/content";
import { AgentProfileNotFoundState } from "@web/components/agents/agent-profile/detail/not-found-state";
import { AgentProfileDetailSkeleton } from "@web/components/agents/agent-profile/detail/skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { QueryList } from "@web/components/shell/query-list";

export function AgentProfileSection() {
  const { profileId } = useParams({ from: "/settings/agents/$profileId" });
  const profiles = useAgentProfiles();
  const runtimes = useRuntimes();
  const profile = profiles.data?.find((candidate) => candidate.id === profileId);

  return (
    <QueryList
      query={profiles}
      pending={<AgentProfileDetailSkeleton />}
      error={
        <ErrorState
          variant="inline"
          title="Couldn’t load the agent profile"
          onRetry={() => void profiles.refetch()}
        />
      }
      empty={<AgentProfileNotFoundState />}
    >
      {() => {
        if (!profile) return <AgentProfileNotFoundState />;
        return (
          <QueryBoundary
            query={runtimes}
            pending={<AgentProfileDetailSkeleton />}
            error={
              <ErrorState
                variant="inline"
                title="Couldn’t load runtimes"
                onRetry={() => void runtimes.refetch()}
              />
            }
          >
            {(descriptors) => <AgentProfileDetail profile={profile} descriptors={descriptors} />}
          </QueryBoundary>
        );
      }}
    </QueryList>
  );
}
