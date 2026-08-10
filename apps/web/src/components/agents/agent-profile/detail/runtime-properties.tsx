import type { AgentProfileContract, RuntimeDescriptor } from "@otomat/domain";
import { Chip, Icon, MetaList, ProviderMark, type MetaListItem } from "@otomat/ui";
import { useRuntimeProviderOptions } from "@web/api/daemon/queries";
import { providerOptionKeyLabel, providerOptionValueLabel } from "@web/lib/provider-option-labels";
import { effectiveProviderOptionLabel, unofferedProviderOptions } from "@web/lib/provider-options";
import { runtimeMark } from "@web/lib/runtimes";

export function RuntimeProperties({
  profile,
  descriptor,
}: {
  profile: AgentProfileContract;
  descriptor: RuntimeDescriptor | undefined;
}) {
  const detected = useRuntimeProviderOptions(profile.runtime, profile.model);
  const mark = runtimeMark(profile.runtime);
  const items: MetaListItem[] = [
    {
      key: "runtime",
      label: "Runtime",
      value: (
        <span className="inline-flex items-center gap-1.5 text-text-secondary">
          {mark ? (
            <ProviderMark name={mark} />
          ) : (
            <Icon name="cpu" aria-hidden className="size-3.25 text-text-tertiary" />
          )}
          {descriptor?.display_name ?? profile.runtime}
        </span>
      ),
    },
    {
      key: "model",
      label: "Model",
      value: <Chip tone="ghost">{profile.model ?? "Default"}</Chip>,
    },
  ];

  for (const option of detected.data?.options ?? []) {
    items.push({
      key: option.key,
      label: providerOptionKeyLabel(option.key),
      value: (
        <Chip tone="ghost">
          {effectiveProviderOptionLabel(option, profile.options[option.key] ?? null)}
        </Chip>
      ),
    });
  }
  for (const stored of unofferedProviderOptions(profile.options, detected.data)) {
    items.push({
      key: stored.key,
      label: providerOptionKeyLabel(stored.key),
      value: <Chip tone="warning">{providerOptionValueLabel(stored.value)} — not offered</Chip>,
    });
  }

  return <MetaList items={items} />;
}
