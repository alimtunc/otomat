import type { AgentProfileContract } from "@otomat/domain";
import { Badge, Button, EmptyState, ErrorState, Icon, Pill, PillTabs } from "@otomat/ui";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { AgentProfileDialog } from "@web/components/agents/agent-profile-dialog";
import { AgentProfileList } from "@web/components/agents/agent-profile-list";
import { CenteredState } from "@web/components/shell/centered-state";
import { ListSkeleton } from "@web/components/shell/list-skeleton";
import { QueryBoundary } from "@web/components/shell/query-boundary";
import { QueryList } from "@web/components/shell/query-list";
import { RouteShell } from "@web/components/shell/route-shell";
import { useState } from "react";

type ProfileFilter = "all" | "skills" | "instructions";

function isProfileFilter(value: string): value is ProfileFilter {
  return value === "all" || value === "skills" || value === "instructions";
}

function matchesFilter(profile: AgentProfileContract, filter: ProfileFilter): boolean {
  if (filter === "skills") return profile.skill_ids.length > 0;
  if (filter === "instructions") return Boolean(profile.guidance?.trim());
  return true;
}

export function AgentsView() {
  const profiles = useAgentProfiles();
  const runtimes = useRuntimes();

  const [filter, setFilter] = useState<ProfileFilter>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AgentProfileContract | null>(null);

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(profile: AgentProfileContract) {
    setEditing(profile);
    setDialogOpen(true);
  }

  return (
    <RouteShell
      active="agents"
      titleIcon="bot"
      titleNote="Reusable profiles that configure how agents handle runs."
      breadcrumbs={[{ label: "Agents", current: true }]}
      actions={
        <Button variant="primary" size="sm" onClick={openCreate}>
          <Icon name="plus" aria-hidden />
          New profile
        </Button>
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex h-10.5 flex-none items-center border-b border-border-subtle px-4.5">
          <PillTabs
            type="single"
            value={filter}
            onValueChange={(value) => {
              if (isProfileFilter(value)) setFilter(value);
            }}
            aria-label="Agent profile filter"
          >
            <Pill value="all" badge={<Badge variant="count">{profiles.data?.length ?? 0}</Badge>}>
              All
            </Pill>
            <Pill
              value="skills"
              badge={
                <Badge variant="count">
                  {profiles.data?.filter((profile) => profile.skill_ids.length > 0).length ?? 0}
                </Badge>
              }
            >
              With skills
            </Pill>
            <Pill
              value="instructions"
              badge={
                <Badge variant="count">
                  {profiles.data?.filter((profile) => profile.guidance?.trim()).length ?? 0}
                </Badge>
              }
            >
              With instructions
            </Pill>
          </PillTabs>
        </div>

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
                    <Button variant="primary" size="sm" onClick={openCreate}>
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
                    matchesFilter(profile, filter),
                  );
                  return filteredProfiles.length > 0 ? (
                    <AgentProfileList
                      profiles={filteredProfiles}
                      descriptors={runtimeDescriptors}
                      onEdit={openEdit}
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
      </div>

      {dialogOpen ? (
        <AgentProfileDialog open={dialogOpen} onOpenChange={setDialogOpen} profile={editing} />
      ) : null}
    </RouteShell>
  );
}
