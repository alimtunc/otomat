import type { AgentProfileContract } from "@otomat/domain";
import { Button, Icon } from "@otomat/ui";
import { useAgentProfiles } from "@web/api/agent-profiles/queries";
import { useRuntimes } from "@web/api/daemon/queries";
import { AgentProfileDialog } from "@web/components/agents/agent-profile/dialog/agent-profile-dialog";
import { AgentProfileListContent } from "@web/components/agents/agent-profile/list/content";
import {
  AgentProfileFilters,
  type ProfileFilter,
} from "@web/components/agents/agent-profile/list/filters";
import { RouteShell } from "@web/components/shell/route-shell";
import { useState } from "react";

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
        <AgentProfileFilters
          profiles={profiles.data ?? []}
          value={filter}
          onValueChange={setFilter}
        />
        <AgentProfileListContent
          profiles={profiles}
          runtimes={runtimes}
          filter={filter}
          onCreate={openCreate}
          onEdit={openEdit}
        />
      </div>
      {dialogOpen ? (
        <AgentProfileDialog open={dialogOpen} onOpenChange={setDialogOpen} profile={editing} />
      ) : null}
    </RouteShell>
  );
}
