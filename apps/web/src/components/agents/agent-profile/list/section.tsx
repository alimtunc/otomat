import type { AgentProfileContract } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { AgentProfileDialog } from "@web/components/agents/agent-profile/dialog/agent-profile-dialog";
import { AgentProfileListContent } from "@web/components/agents/agent-profile/list/content";
import { AgentProfileFilters } from "@web/components/agents/agent-profile/list/filters";
import type { ProfileFilter } from "@web/components/agents/agent-profile/list/profile-filter";
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
        description="The agent profiles you define: the runtime each one launches on, the instructions it starts from, and the skills it activates. Detected runtime capabilities live under Reference."
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
        filter={filter}
        onCreate={() => setEditing({ profile: null })}
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
