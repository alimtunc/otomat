import type { LinearDeliverySnapshot } from "@otomat/domain";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { desktopBridge, requireDesktopBridge } from "@web/lib/desktop-bridge";
import { useEffect } from "react";

const LINEAR_DELIVERY_KEY = ["linear-delivery"] as const;

/** Null in the browser, which has no vault: there the daemon it was started against holds its own key. */
export function useLinearDelivery(): LinearDeliverySnapshot | null {
  const bridge = desktopBridge();
  const client = useQueryClient();

  const delivery = useQuery({
    queryKey: LINEAR_DELIVERY_KEY,
    queryFn: () => requireDesktopBridge(bridge).linear.delivery(),
    enabled: bridge !== null,
  });

  // otomat-allow-effect: subscribe to the main process's delivery push channel and detach on unmount.
  useEffect(() => {
    if (bridge === null) return;
    return bridge.linear.onDelivery((snapshot) => {
      client.setQueryData(LINEAR_DELIVERY_KEY, snapshot);
    });
  }, [bridge, client]);

  return delivery.data ?? null;
}
