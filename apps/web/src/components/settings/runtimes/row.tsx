import type { RuntimeDescriptor } from "@otomat/domain";
import { Chip, ProviderMark } from "@otomat/ui";
import { capabilityEntries } from "@web/lib/capability-labels";
import { runtimeAvailabilityLabel } from "@web/lib/runtime-availability";
import {
  isAvailableRuntime,
  isRealRuntime,
  runtimeMark,
  SIMULATED_RUNTIME_NOTE,
} from "@web/lib/runtimes";

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
        {available ? null : (
          <Chip tone="warning">{runtimeAvailabilityLabel(runtime, hostLabel)}</Chip>
        )}
      </div>
      {isRealRuntime(runtime) ? null : (
        <p className="text-xs text-text-secondary">{SIMULATED_RUNTIME_NOTE}</p>
      )}
      <ul className="grid gap-x-5 gap-y-1 text-xs text-text-secondary sm:grid-cols-2">
        {capabilityEntries(runtime.capabilities).map(({ key, label, supported }) => (
          <li key={key} className="flex items-center gap-2">
            <span
              aria-label={supported ? "Supported" : "Not supported"}
              className="w-3 text-text-tertiary"
            >
              {supported ? "✓" : "—"}
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
