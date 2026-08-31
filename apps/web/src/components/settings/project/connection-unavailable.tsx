import type { LinearConnectionContract } from "@otomat/domain";
import { useLinearDelivery } from "@web/api/linear/use-delivery";
import { activeExecutionHostId } from "@web/lib/desktop-bridge";

export interface ConnectionUnavailableProps {
  connectionId: string;
  /** Null when this project maps a connection the active host's daemon does not catalogue. */
  connection: LinearConnectionContract | null;
}

export function ConnectionUnavailable({ connectionId, connection }: ConnectionUnavailableProps) {
  const delivery = useLinearDelivery();
  const hostDelivery = delivery?.connections
    .find((candidate) => candidate.connection_id === connectionId)
    ?.hosts.find((host) => host.host_id === activeExecutionHostId());

  if (connection === null) {
    return (
      <p className="text-xs text-text-tertiary">
        This project maps a Linear connection this host does not know. Connect it again in global
        Integrations, or unmap its sources.
      </p>
    );
  }
  if (connection.error_message !== null) {
    return (
      <p className="text-xs text-text-tertiary">
        {connection.label} lost its access: {connection.error_message} Reconnect it in global
        Integrations.
      </p>
    );
  }
  return (
    <p className="text-xs text-text-tertiary">
      {hostDelivery === undefined || hostDelivery.state === "delivered"
        ? `${connection.label} holds no key on this host yet, so this project cannot be mapped from here.`
        : `${hostDelivery.label} has not received ${connection.label}'s key yet, so this project cannot be mapped from here.`}
      {hostDelivery?.detail === undefined || hostDelivery.detail === null
        ? null
        : ` ${hostDelivery.detail}`}
    </p>
  );
}
