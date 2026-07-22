import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { Chip, Icon, MetaList } from "@otomat/ui";
import { permissionModeOption, storedPermissionModeLabel } from "@web/lib/agent-choice";

export function RuntimeProperties({
  profile,
  descriptor,
}: {
  profile: AgentProfileContract;
  descriptor: RuntimeDescriptor | undefined;
}) {
  const permissionOption = permissionModeOption(descriptor?.provider_options);
  const permissionLabel = storedPermissionModeLabel(profile, descriptor) ?? "Runtime default";
  const items = [
    {
      key: "runtime",
      label: "Runtime",
      value: (
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          <Icon name="cpu" aria-hidden className="size-3.25 text-text-tertiary" />
          {descriptor?.display_name ?? profile.runtime}
        </span>
      ),
    },
  ];

  if (permissionOption) {
    items.push({
      key: "options",
      label: "Options",
      value: <Chip tone="ghost">{permissionLabel}</Chip>,
    });
  }

  return <MetaList items={items} />;
}
