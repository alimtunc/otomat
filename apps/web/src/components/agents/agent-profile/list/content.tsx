import type { AgentProfileContract } from "@otomat/domain";
import { ErrorState } from "@otomat/ui";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { useSkills } from "@web/api/skills/queries";
import { AgentProfileList } from "@web/components/agents/agent-profile/list/table";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { QueryList } from "@web/components/shell/query-list";
import type { ReactNode } from "react";

const retry = (title: string, refetch: () => void) => (
  <ErrorState variant="inline" title={title} onRetry={refetch} />
);

export function AgentProfileListContent({
  profiles,
  runtimes,
  select,
  empty,
  emptySelection,
  onEdit,
}: {
  profiles: ReturnType<typeof useAgentProfiles>;
  runtimes: ReturnType<typeof useRuntimes>;
  select: (profiles: AgentProfileContract[]) => AgentProfileContract[];
  empty: ReactNode;
  emptySelection: ReactNode;
  onEdit: (profile: AgentProfileContract) => void;
}) {
  const skills = useSkills();
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-card">
      <QueryList
        query={profiles}
        pending={<ListSkeleton rows={3} height={40} />}
        error={retry("Couldn’t load agent profiles", () => void profiles.refetch())}
        empty={empty}
      >
        {(items) => (
          <QueryBoundary
            query={runtimes}
            pending={<ListSkeleton rows={items.length} height={40} />}
            error={retry("Couldn’t load runtimes", () => void runtimes.refetch())}
          >
            {(descriptors) => (
              <QueryBoundary
                query={skills}
                pending={<ListSkeleton rows={items.length} height={40} />}
                error={retry("Couldn’t load the skill catalog", () => void skills.refetch())}
              >
                {(catalog) => {
                  const selected = select(items);
                  return selected.length > 0 ? (
                    <AgentProfileList
                      profiles={selected}
                      descriptors={descriptors}
                      skills={catalog}
                      onEdit={onEdit}
                    />
                  ) : (
                    emptySelection
                  );
                }}
              </QueryBoundary>
            )}
          </QueryBoundary>
        )}
      </QueryList>
    </div>
  );
}
