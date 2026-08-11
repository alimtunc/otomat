import type { RuntimeDescriptor } from "@otomat/domain";
import { Badge, ProviderMark } from "@otomat/ui";
import { capabilityEntries } from "@web/lib/capability-labels";
import { runtimeMark } from "@web/lib/runtimes";

export function RuntimeRow({ runtime }: { runtime: RuntimeDescriptor }) {
  const mark = runtimeMark(runtime.id);
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center gap-2">
        {mark ? <ProviderMark name={mark} className="size-5" /> : null}
        <span className="text-sm font-medium text-foreground">{runtime.display_name}</span>
        <span className="text-micro text-text-tertiary">{runtime.id}</span>
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
