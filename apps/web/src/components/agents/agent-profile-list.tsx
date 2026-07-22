import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import {
  AgentAvatar,
  Button,
  Chip,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Icon,
  IconButton,
  toast,
} from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { useDeleteAgentProfile, useDuplicateAgentProfile } from "@web/api/agent-profiles/mutations";
import { FOCUS_RING } from "@web/lib/focus";
import { CELL, HEAD_CELL, TABLE } from "@web/lib/table";
import { useState } from "react";

function findRuntime(descriptors: RuntimeDescriptor[], runtimeId: string) {
  return descriptors.find((descriptor) => descriptor.id === runtimeId);
}

function permissionModeLabel(
  profile: AgentProfileContract,
  descriptor: RuntimeDescriptor | undefined,
): string | null {
  const value = profile.options.permission_mode;
  if (!value) return null;
  const option = descriptor?.provider_options.find((entry) => entry.key === "permission_mode");
  if (!option) return null;
  return option.choices.find((choice) => choice.value === value)?.label ?? value;
}

function ProfileRowActions({
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

function AgentProfileRow({
  profile,
  descriptors,
  onEdit,
}: {
  profile: AgentProfileContract;
  descriptors: RuntimeDescriptor[];
  onEdit: (profile: AgentProfileContract) => void;
}) {
  const descriptor = findRuntime(descriptors, profile.runtime);
  const optionLabel = permissionModeLabel(profile, descriptor);

  return (
    <tr className="relative transition-colors hover:bg-hover">
      <td className={`${CELL} min-w-64 p-0`}>
        <Link
          to="/agents/$profileId"
          params={{ profileId: profile.id }}
          className={`flex h-full min-w-0 items-center gap-2.5 px-3 after:absolute after:inset-0 ${FOCUS_RING} focus-visible:outline-offset-[-2px]`}
        >
          <AgentAvatar name={profile.name} />
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate font-medium text-foreground">{profile.name}</span>
            <span className="block truncate text-xs text-text-tertiary">
              {profile.guidance?.trim() || "No instructions yet."}
            </span>
          </span>
        </Link>
      </td>
      <td className={CELL}>
        <Chip tone="neutral">{descriptor?.display_name ?? profile.runtime}</Chip>
      </td>
      <td className={`${CELL} font-mono text-xs text-text-secondary tabular-nums`}>
        {profile.skill_ids.length}
      </td>
      <td className={CELL}>
        {optionLabel ? (
          <Chip tone="ghost">{optionLabel}</Chip>
        ) : (
          <span className="text-text-tertiary">—</span>
        )}
      </td>
      <td className={`${CELL} w-24 px-2 text-right`}>
        <ProfileRowActions profile={profile} onEdit={onEdit} />
      </td>
    </tr>
  );
}

export function AgentProfileList({
  profiles,
  descriptors,
  onEdit,
}: {
  profiles: AgentProfileContract[];
  descriptors: RuntimeDescriptor[];
  onEdit: (profile: AgentProfileContract) => void;
}) {
  return (
    <table className={TABLE}>
      <thead>
        <tr>
          <th className={HEAD_CELL}>Agent</th>
          <th className={`${HEAD_CELL} w-40`}>Runtime</th>
          <th className={`${HEAD_CELL} w-24`}>Skills</th>
          <th className={`${HEAD_CELL} w-40`}>Options</th>
          <th className={`${HEAD_CELL} w-24 text-right`}>Actions</th>
        </tr>
      </thead>
      <tbody>
        {profiles.map((profile) => (
          <AgentProfileRow
            key={profile.id}
            profile={profile}
            descriptors={descriptors}
            onEdit={onEdit}
          />
        ))}
      </tbody>
    </table>
  );
}
