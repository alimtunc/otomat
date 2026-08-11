import type { RuntimeDescriptor } from "@otomat/domain";
import { Icon } from "@otomat/ui";
import { capabilityEntries } from "@web/lib/capability-labels";

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
      {capabilityEntries(descriptor.capabilities).map(({ key, label, supported }) => (
        <div
          key={key}
          className={
            supported
              ? "flex items-center gap-1.75"
              : "flex items-center gap-1.75 text-text-tertiary"
          }
        >
          <Icon
            name={supported ? "check" : "x"}
            aria-hidden
            className={supported ? "size-3.25 text-success" : "size-3.25"}
          />
          <span>{supported ? label : `${label} — unavailable`}</span>
        </div>
      ))}
    </div>
  );
}
