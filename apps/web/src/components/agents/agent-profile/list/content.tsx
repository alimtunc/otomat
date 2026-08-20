import type { AgentProfileContract } from "@otomat/domain";
import { Button, EmptyState, ErrorState, Icon } from "@otomat/ui";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import {
  matchesProfileFilter,
  type ProfileFilter,
} from "@web/components/agents/agent-profile/list/profile-filter";
import { AgentProfileList } from "@web/components/agents/agent-profile/list/table";
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
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-card">
      <QueryList
        query={profiles}
        pending={<ListSkeleton rows={3} height={40} />}
        error={
          <ErrorState
            variant="inline"
            title="Couldn’t load agent profiles"
            onRetry={() => void profiles.refetch()}
          />
        }
        empty={
          <EmptyState
            icon="bot"
            variant="inline"
            title="No agent profiles yet"
            description="Create a reusable profile with a runtime, instructions and skills."
            action={
              <Button variant="primary" size="sm" onClick={onCreate}>
                <Icon name="plus" aria-hidden />
                New profile
              </Button>
            }
          />
        }
      >
        {(items) => (
          <QueryBoundary
            query={runtimes}
            pending={<ListSkeleton rows={items.length} height={40} />}
            error={
              <ErrorState
                variant="inline"
                title="Couldn’t load runtimes"
                onRetry={() => void runtimes.refetch()}
              />
            }
          >
            {(runtimeDescriptors) => {
              const filtered = items.filter((profile) => matchesProfileFilter(profile, filter));
              return filtered.length > 0 ? (
                <AgentProfileList
                  profiles={filtered}
                  descriptors={runtimeDescriptors}
                  onEdit={onEdit}
                />
              ) : (
                <EmptyState
                  icon="bot"
                  variant="inline"
                  title="No matching profiles"
                  description="Choose another filter to see your agent profiles."
                />
              );
            }}
          </QueryBoundary>
        )}
      </QueryList>
    </div>
  );
}
