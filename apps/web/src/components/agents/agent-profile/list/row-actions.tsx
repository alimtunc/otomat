import type { AgentProfileContract } from "@otomat/domain";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  toast,
} from "@otomat/ui";
import { useDeleteAgentProfile, useDuplicateAgentProfile } from "@web/api/agent-profiles/mutations";
import { useState } from "react";

export function AgentProfileRowActions({
  profile,
  onEdit,
}: {
  profile: AgentProfileContract;
  onEdit: (profile: AgentProfileContract) => void;
}) {
  const duplicate = useDuplicateAgentProfile();
  const remove = useDeleteAgentProfile();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (confirmingDelete) {
    return (
      <div className="relative z-[1] flex items-center justify-end gap-1">
        <Button
          variant="destructive"
          size="xs"
          loading={remove.isPending}
          onClick={() =>
            remove.mutate(profile.id, {
              onSuccess: () => toast.success("Profile deleted"),
              onError: () => {
                toast.error("Could not delete the profile.");
                setConfirmingDelete(false);
              },
            })
          }
        >
          Confirm
        </Button>
        <Button autoFocus variant="ghost" size="xs" onClick={() => setConfirmingDelete(false)}>
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <IconButton
            label={`Actions for ${profile.name}`}
            size="sm"
            icon={<Icon name="more-horizontal" />}
            className="relative z-[1] ml-auto"
          />
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onEdit(profile)}>Edit</DropdownMenuItem>
        <DropdownMenuItem
          disabled={duplicate.isPending}
          onClick={() =>
            duplicate.mutate(profile.id, {
              onSuccess: () => toast.success("Profile duplicated"),
              onError: () => toast.error("Could not duplicate the profile."),
            })
          }
        >
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-danger" onClick={() => setConfirmingDelete(true)}>
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
