import type { RuntimeDescriptor } from "@otomat/domain";
import { Badge, Chip, ProviderMark } from "@otomat/ui";
import { capabilityEntries } from "@web/lib/capability-labels";
import { runtimeAvailabilityLabel } from "@web/lib/runtime-availability";
import { isAvailableRuntime, runtimeMark } from "@web/lib/runtimes";

export function RuntimeRow({
  runtime,
  hostLabel,
}: {
  runtime: RuntimeDescriptor;
  hostLabel: string;
}) {
  const mark = runtimeMark(runtime.id);
  const available = isAvailableRuntime(runtime);
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        {mark ? <ProviderMark name={mark} className="size-5" /> : null}
        <span className="text-sm font-medium text-foreground">{runtime.display_name}</span>
        <span className="text-micro text-text-tertiary">{runtime.id}</span>
        <Chip tone={available ? "success" : "warning"}>
          {runtimeAvailabilityLabel(runtime, hostLabel)}
        </Chip>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {capabilityEntries(runtime.capabilities).map(({ key, label, supported }) => (
          <Badge key={key} variant={supported ? "iris" : "default"}>
            {supported ? label : `No ${label.toLowerCase()}`}
          </Badge>
        ))}
      </div>
    </div>
  );
}
