import type { LinearHostDeliveryState } from "@otomat/domain";
import { useLinearDelivery } from "@web/api/linear/use-delivery";

const STATES = {
  delivered: { label: "Connected", tone: "text-text-secondary" },
  cleared: { label: "No key", tone: "text-text-tertiary" },
  pending_restore: { label: "Waiting to receive the key", tone: "text-text-tertiary" },
  pending_revocation: { label: "Waiting to revoke the key", tone: "text-warning" },
  unavailable: { label: "Unavailable", tone: "text-text-tertiary" },
} satisfies Record<LinearHostDeliveryState, { label: string; tone: string }>;

export function ConnectionDelivery({ connectionId }: { connectionId: string }) {
  const delivery = useLinearDelivery();
  const connection = delivery?.connections.find(
    (candidate) => candidate.connection_id === connectionId,
  );
  if (connection === undefined) return null;

  return (
    <ul className="flex flex-col gap-1.5 border-t border-border-subtle px-3 py-2">
      {connection.hosts.map((host) => (
        <li key={host.host_id} className="flex flex-col gap-0.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-xs text-text-secondary">{host.label}</span>
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
  );
}
