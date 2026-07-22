import type { RuntimeDescriptor } from "@otomat/domain";
import { Icon } from "@otomat/ui";
import { CAPABILITY_ENTRIES } from "@web/lib/capability-labels";

export function CapabilitySnapshot({ descriptor }: { descriptor: RuntimeDescriptor | undefined }) {
  if (!descriptor) {
    return (
      <p className="text-xs leading-relaxed text-text-tertiary">
        This runtime is not currently reported, so its capabilities cannot be verified.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1.75 text-xs">
      {CAPABILITY_ENTRIES.map(({ key, label }) => {
        const available = descriptor.capabilities[key];
        return (
          <div
            key={key}
            className={
              available
                ? "flex items-center gap-1.75"
                : "flex items-center gap-1.75 text-text-tertiary"
            }
          >
            <Icon
              name={available ? "check" : "x"}
              aria-hidden
              className={available ? "size-3.25 text-success" : "size-3.25"}
            />
            <span>{available ? label : `${label} — unavailable`}</span>
          </div>
        );
      })}
    </div>
  );
}
