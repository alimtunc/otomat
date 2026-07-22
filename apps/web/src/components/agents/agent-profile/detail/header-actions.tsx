import type { AgentProfileContract } from "@otomat/domain";
import { Button, toast } from "@otomat/ui";
import { useNavigate } from "@tanstack/react-router";
import { useDeleteAgentProfile, useDuplicateAgentProfile } from "@web/api/agent-profiles/mutations";
import { AgentProfileDialog } from "@web/components/agents/agent-profile/dialog/agent-profile-dialog";
import { useState } from "react";

export function AgentProfileHeaderActions({ profile }: { profile: AgentProfileContract }) {
  const navigate = useNavigate();
  const duplicate = useDuplicateAgentProfile();
  const remove = useDeleteAgentProfile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        {confirmingDelete ? (
          <>
            <Button
              variant="destructive"
              size="xs"
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(profile.id, {
                  onSuccess: () => {
                    toast.success("Profile deleted");
                    void navigate({ to: "/agents" });
                  },
                  onError: () => toast.error("Could not delete the profile."),
                })
              }
            >
              Confirm delete
            </Button>
            <Button autoFocus variant="ghost" size="xs" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" size="xs" onClick={() => setDialogOpen(true)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              size="xs"
              loading={duplicate.isPending}
              onClick={() =>
                duplicate.mutate(profile.id, {
                  onSuccess: (copy) => {
                    toast.success("Profile duplicated");
                    void navigate({
                      to: "/agents/$profileId",
                      params: { profileId: copy.id },
                    });
                  },
                  onError: () => toast.error("Could not duplicate the profile."),
                })
              }
            >
              Duplicate
            </Button>
            <Button variant="destructive" size="xs" onClick={() => setConfirmingDelete(true)}>
              Delete
            </Button>
          </>
        )}
      </div>
      {dialogOpen ? (
        <AgentProfileDialog open={dialogOpen} onOpenChange={setDialogOpen} profile={profile} />
      ) : null}
    </>
  );
}
