import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { AgentAvatar, Chip } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { AgentProfileHeaderActions } from "@web/components/agents/agent-profile/detail/header-actions";
import { InstructionsPanel } from "@web/components/agents/agent-profile/detail/instructions-panel";
import { RuntimeProperties } from "@web/components/agents/agent-profile/detail/runtime-properties";
import { SkillsPanel } from "@web/components/agents/agent-profile/detail/skills-panel";
import { useRemoteSession } from "@web/components/shell/remote-session/context";
import { executionHostLabel } from "@web/components/shell/remote-session/status-labels";
import { runtimeAvailabilityLabel } from "@web/lib/runtime-availability";
import { isAvailableRuntime, runtimeById } from "@web/lib/runtimes";

const PANEL = "rounded-lg border border-border-subtle bg-card px-4 py-3.5";
const PANEL_TITLE = "mb-2.5 text-sm font-semibold text-foreground";

export function AgentProfileDetail({
  profile,
  descriptors,
}: {
  profile: AgentProfileContract;
  descriptors: RuntimeDescriptor[];
}) {
  const hostLabel = executionHostLabel(useRemoteSession());
  const descriptor = runtimeById(descriptors, profile.runtime);
  const launchable = descriptor !== undefined && isAvailableRuntime(descriptor);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-3">
        <AgentAvatar name={profile.name} size="lg" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-foreground">{profile.name}</h1>
          <div className="mt-1.5">
            <Chip tone={launchable ? "success" : "warning"}>
              {runtimeAvailabilityLabel(descriptor, hostLabel)}
            </Chip>
          </div>
        </div>
        <AgentProfileHeaderActions profile={profile} />
      </div>
      <section className={PANEL}>
        <h2 className={PANEL_TITLE}>Runtime</h2>
        <RuntimeProperties profile={profile} descriptor={descriptor} />
        {launchable ? null : (
          <p className="mt-2.5 text-xs leading-relaxed text-text-tertiary">
            This profile cannot be selected on {hostLabel} until its runtime is available there.{" "}
            <Link to="/settings/runtimes" className="underline">
              Reference · Runtimes
            </Link>{" "}
            reports what this host actually detected.
          </p>
        )}
      </section>
      <section className={PANEL}>
        <h2 className={PANEL_TITLE}>Instructions</h2>
        <InstructionsPanel key={`${profile.id}:${profile.guidance ?? ""}`} profile={profile} />
      </section>
      <section className={PANEL}>
        <h2 className={PANEL_TITLE}>Skills</h2>
        <SkillsPanel profile={profile} hostLabel={hostLabel} />
      </section>
    </div>
  );
}
