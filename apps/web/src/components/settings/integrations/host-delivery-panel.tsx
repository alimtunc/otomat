import type { LinearHostDeliveryState } from "@otomat/domain";
import { useLinearDelivery } from "@web/api/linear/use-delivery";

const STATES = {
  delivered: { label: "Connected", tone: "text-text-secondary" },
  cleared: { label: "No key", tone: "text-text-tertiary" },
  pending_restore: { label: "Waiting to receive the key", tone: "text-text-tertiary" },
  pending_revocation: { label: "Waiting to revoke the key", tone: "text-warning" },
  unavailable: { label: "Unavailable", tone: "text-text-tertiary" },
} satisfies Record<LinearHostDeliveryState, { label: string; tone: string }>;

export function HostDeliveryPanel() {
  const delivery = useLinearDelivery();
  if (delivery === null) return null;
  const owed = delivery.hosts.some(
    (host) => host.state === "pending_restore" || host.state === "pending_revocation",
  );
  if (!delivery.stored && !owed) return null;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-card px-3 py-2.5">
      <p className="text-xs text-text-tertiary">
        The key stays on this machine and reaches each host&apos;s daemon in memory.
      </p>
      <ul className="flex flex-col gap-1.5">
        {delivery.hosts.map((host) => (
          <li key={host.host_id} className="flex flex-col gap-0.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-sm text-foreground">{host.label}</span>
              <span className={`shrink-0 text-xs ${STATES[host.state].tone}`}>
                {STATES[host.state].label}
              </span>
            </div>
            {host.detail === null ? null : (
              <span className="text-xs text-text-tertiary">{host.detail}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
