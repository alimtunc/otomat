import type { AgentProfileContract } from "@otomat/domain";
import { Button, EmptyState, ErrorState, Icon } from "@otomat/ui";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import {
  matchesProfileFilter,
  type ProfileFilter,
} from "@web/components/agents/agent-profile/list/filters";
import { AgentProfileList } from "@web/components/agents/agent-profile/list/table";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { QueryList } from "@web/components/shell/query-list";

export function AgentProfileListContent({
  profiles,
  runtimes,
  filter,
  onCreate,
  onEdit,
}: {
  profiles: ReturnType<typeof useAgentProfiles>;
  runtimes: ReturnType<typeof useRuntimes>;
  filter: ProfileFilter;
  onCreate: () => void;
  onEdit: (profile: AgentProfileContract) => void;
}) {
  return (
    <div className="min-h-0 flex-1 overflow-auto">
      <QueryList
        query={profiles}
        pending={<ListSkeleton rows={3} height={40} />}
        error={
          <CenteredState>
            <ErrorState
              title="Couldn’t load agent profiles"
              onRetry={() => void profiles.refetch()}
            />
          </CenteredState>
        }
        empty={
          <CenteredState>
            <EmptyState
              icon="bot"
              title="No agent profiles yet"
              description="Create a reusable profile with a runtime, instructions and skills."
              action={
                <Button variant="primary" size="sm" onClick={onCreate}>
                  <Icon name="plus" aria-hidden />
                  New profile
                </Button>
              }
            />
          </CenteredState>
        }
      >
        {(items) => (
          <QueryBoundary
            query={runtimes}
            pending={<ListSkeleton rows={items.length} height={40} />}
            error={
              <CenteredState>
                <ErrorState
                  title="Couldn’t load runtimes"
                  onRetry={() => void runtimes.refetch()}
                />
              </CenteredState>
            }
          >
            {(runtimeDescriptors) => {
              const filteredProfiles = items.filter((profile) =>
                matchesProfileFilter(profile, filter),
              );
              return filteredProfiles.length > 0 ? (
                <AgentProfileList
                  profiles={filteredProfiles}
                  descriptors={runtimeDescriptors}
                  onEdit={onEdit}
                />
              ) : (
                <CenteredState>
                  <EmptyState
                    icon="bot"
                    title="No matching profiles"
                    description="Choose another filter to see your agent profiles."
                  />
                </CenteredState>
              );
            }}
          </QueryBoundary>
        )}
      </QueryList>
    </div>
  );
}
