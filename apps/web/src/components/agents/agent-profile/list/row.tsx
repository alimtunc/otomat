import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { AgentAvatar, Chip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { AgentProfileRowActions } from "@web/components/agents/agent-profile/list/row-actions";
import { storedPermissionModeLabel } from "@web/lib/agent-choice";
import { FOCUS_RING } from "@web/lib/focus";
import { runtimeById } from "@web/lib/runtimes";
import { CELL } from "@web/lib/table";

export function AgentProfileRow({
  profile,
  descriptors,
  onEdit,
}: {
  profile: AgentProfileContract;
  descriptors: RuntimeDescriptor[];
  onEdit: (profile: AgentProfileContract) => void;
}) {
  const descriptor = runtimeById(descriptors, profile.runtime);
  const optionLabel = storedPermissionModeLabel(profile, descriptor);

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
        <AgentProfileRowActions profile={profile} onEdit={onEdit} />
      </td>
    </tr>
  );
}
