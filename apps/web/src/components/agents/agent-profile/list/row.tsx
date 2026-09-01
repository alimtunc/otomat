import type { AgentProfileContract, RuntimeDescriptor, SkillContract } from "@otomat/domain";
import { AgentAvatar, Chip, FOCUS_RING_INSET, ProviderMark } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { AgentProfileRowActions } from "@web/components/agents/agent-profile/list/row-actions";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { executionHostLabel } from "@web/components/shell/remote-session/status-labels";
import {
  agentProfileAvailability,
  agentProfileAvailabilityLabel,
} from "@web/lib/agent/profile-availability";
import { providerOptionKeyLabel, providerOptionValueLabel } from "@web/lib/provider-option-labels";
import { storedProviderOptions } from "@web/lib/provider-options";
import { runtimeById, runtimeMark } from "@web/lib/runtimes";
import { CELL } from "@web/lib/table";

export function AgentProfileRow({
  profile,
  descriptors,
  skills,
  onEdit,
}: {
  profile: AgentProfileContract;
  descriptors: RuntimeDescriptor[];
  skills: SkillContract[];
  onEdit: (profile: AgentProfileContract) => void;
}) {
  const hostLabel = executionHostLabel(useRemoteSession());
  const descriptor = runtimeById(descriptors, profile.runtime);
  const options = storedProviderOptions(profile.options);
  const mark = runtimeMark(profile.runtime);
  const availability = agentProfileAvailability(profile, descriptors, skills);

  return (
    <tr className="relative transition-colors hover:bg-hover">
      <td className={`${CELL} min-w-64 p-0`}>
        <Link
          to="/settings/agents/$profileId"
          params={{ profileId: profile.id }}
          className={`flex h-full min-w-0 items-center gap-2.5 px-3 after:absolute after:inset-0 ${FOCUS_RING_INSET}`}
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
        <Chip tone="neutral">
          {mark ? <ProviderMark name={mark} /> : null}
          {descriptor?.display_name ?? profile.runtime}
        </Chip>
      </td>
      <td className={CELL}>
        <Chip tone={availability.usable ? "success" : "warning"}>
          {agentProfileAvailabilityLabel(availability, hostLabel)}
        </Chip>
      </td>
      <td className={`${CELL} font-mono text-xs text-text-secondary tabular-nums`}>
        {profile.skill_ids.length}
      </td>
      <td className={CELL}>
        {options.length > 0 ? (
          <span className="flex flex-wrap gap-1">
            {options.map((option) => (
              <Chip key={option.key} tone="ghost">
                {providerOptionKeyLabel(option.key)}:{" "}
                {providerOptionValueLabel(option.key, option.value)}
              </Chip>
            ))}
          </span>
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
