import { ErrorState } from "@otomat/ui";
import { useParams } from "@tanstack/react-router";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { AgentProfileDetail } from "@web/components/agents/agent-profile/detail/content";
import { AgentProfileHeaderActions } from "@web/components/agents/agent-profile/detail/header-actions";
import { AgentProfileNotFoundState } from "@web/components/agents/agent-profile/detail/not-found-state";
import { AgentProfileDetailSkeleton } from "@web/components/agents/agent-profile/detail/skeleton";
import { CenteredState } from "@web/components/shell/centered-state";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";

export function AgentProfileDetailView() {
  const { profileId } = useParams({ from: "/agents/$profileId" });
  const profiles = useAgentProfiles();
  const runtimes = useRuntimes();
  const profile = profiles.data?.find((candidate) => candidate.id === profileId);

  return (
    <RouteShell
      active="agents"
      breadcrumbs={[
        { label: "Agents", href: "/agents" },
        { label: profile?.name ?? "Profile", current: true },
      ]}
      actions={profile ? <AgentProfileHeaderActions profile={profile} /> : null}
    >
      <QueryList
        query={profiles}
        pending={<AgentProfileDetailSkeleton />}
        error={
          <CenteredState>
            <ErrorState
              title="Couldn’t load the agent profile"
              onRetry={() => void profiles.refetch()}
            />
          </CenteredState>
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
                <CenteredState>
                  <ErrorState
                    title="Couldn’t load runtime capabilities"
                    onRetry={() => void runtimes.refetch()}
                  />
                </CenteredState>
              }
            >
              {(descriptors) => <AgentProfileDetail profile={profile} descriptors={descriptors} />}
            </QueryBoundary>
          );
        }}
      </QueryList>
    </RouteShell>
  );
}
