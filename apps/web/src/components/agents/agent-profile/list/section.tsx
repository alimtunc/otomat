import type { AgentProfileContract } from "@otomat/domain";
import { Button, EmptyState, Icon } from "@otomat/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { AgentProfileDialog } from "@web/components/agents/agent-profile/dialog/agent-profile-dialog";
import { AgentProfileListContent } from "@web/components/agents/agent-profile/list/content";
import { AgentProfileFilters } from "@web/components/agents/agent-profile/list/filters";
import {
  matchesProfileFilter,
  type ProfileFilter,
} from "@web/components/agents/agent-profile/list/profile-filter";
import { SectionHeading } from "@web/components/settings/section-heading";
import { useState } from "react";

export function AgentProfilesSection() {
  const profiles = useAgentProfiles();
  const runtimes = useRuntimes();
  const { filter = "all" } = useSearch({ from: "/settings/agents/" });
  const navigate = useNavigate();
  const [editing, setEditing] = useState<{ profile: AgentProfileContract | null } | null>(null);

  const selectFilter = (next: ProfileFilter): void => {
    void navigate({ to: "/settings/agents", search: { filter: next }, replace: true });
  };

  return (
    <div>
      <SectionHeading
        title="Agents"
        description="The global agent profiles you define: the runtime each one launches on, the instructions it starts from, and the user skills it activates. Agents that need a repository's own skills live under Project · Agents."
      />
      <div className="mb-4 flex items-center justify-between gap-3">
        <AgentProfileFilters
          profiles={profiles.data ?? []}
          value={filter}
          onValueChange={selectFilter}
        />
        <Button variant="primary" size="sm" onClick={() => setEditing({ profile: null })}>
          <Icon name="plus" aria-hidden />
          New profile
        </Button>
      </div>
      <AgentProfileListContent
        profiles={profiles}
        runtimes={runtimes}
        select={(items) => items.filter((profile) => matchesProfileFilter(profile, filter))}
        empty={
          <EmptyState
            icon="bot"
            variant="inline"
            title="No agent profiles yet"
            description="Create a reusable profile with a runtime, instructions and the user skills it activates."
          />
        }
        emptySelection={
          <EmptyState
            icon="bot"
            variant="inline"
            title="No matching profiles"
            description="Choose another filter to see your agent profiles."
          />
        }
        onEdit={(profile) => setEditing({ profile })}
      />
      {editing === null ? null : (
        <AgentProfileDialog
          open
          onOpenChange={(open) => {
            if (!open) setEditing(null);
          }}
          profile={editing.profile}
        />
      )}
    </div>
  );
}
