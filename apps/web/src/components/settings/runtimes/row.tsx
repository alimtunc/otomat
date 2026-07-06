import type { RuntimeDescriptor } from "@otomat/domain";
import { Badge } from "@otomat/ui";
import { CAPABILITY_ENTRIES } from "@web/components/settings/runtimes/capability-labels";

export function RuntimeRow({ runtime }: { runtime: RuntimeDescriptor }) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-medium text-foreground">{runtime.display_name}</span>
        <span className="text-micro text-text-tertiary">{runtime.id}</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CAPABILITY_ENTRIES.map(({ key, label }) => (
          <Badge key={key} variant={runtime.capabilities[key] ? "iris" : "default"}>
            {runtime.capabilities[key] ? label : `No ${label.toLowerCase()}`}
          </Badge>
        ))}
      </div>
    </div>
  );
}
