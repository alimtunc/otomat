import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { AgentAvatar, cn, SidePanelToggle, useSidePanel } from "@otomat/ui";
import { CapabilitySnapshot } from "@web/components/agents/agent-profile/detail/capability-snapshot";
import { RuntimeAvailability } from "@web/components/agents/agent-profile/detail/runtime-availability";
import { RuntimeProperties } from "@web/components/agents/agent-profile/detail/runtime-properties";

export function AgentProfileRail({
  profile,
  descriptor,
}: {
  profile: AgentProfileContract;
  descriptor: RuntimeDescriptor | undefined;
}) {
  const panel = useSidePanel();
  return (
    <aside
      className={cn(
        "min-h-0 min-w-0 flex-1 overflow-auto bg-sidebar p-4",
        panel === null ? "border-b border-border-subtle" : null,
      )}
    >
      <div className="mb-3.5 flex flex-col items-start gap-2 border-b border-border-subtle pb-3.5">
        <AgentAvatar name={profile.name} size="lg" />
        <div className="flex w-full items-center gap-2">
          <h2 className="min-w-0 truncate text-md font-semibold text-foreground">{profile.name}</h2>
          <SidePanelToggle className="-mr-1.5 ml-auto" />
        </div>
        <RuntimeAvailability descriptor={descriptor} />
      </div>
      <section className="mb-2.5 rounded-lg border border-border-subtle bg-card px-3.25 py-3">
        <h3 className="mb-2.5 text-micro font-semibold uppercase tracking-[0.03em] text-text-tertiary">
          Properties
        </h3>
        <RuntimeProperties profile={profile} descriptor={descriptor} />
      </section>
      <section className="rounded-lg border border-border-subtle bg-card px-3.25 py-3">
        <h3 className="mb-2.5 text-micro font-semibold uppercase tracking-[0.03em] text-text-tertiary">
          Capability snapshot <span className="font-normal normal-case">· honest</span>
        </h3>
        <CapabilitySnapshot descriptor={descriptor} />
      </section>
    </aside>
  );
}
