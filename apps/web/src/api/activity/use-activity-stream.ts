import { useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useQueryKeys } from "@web/api/use-query-keys";
import { useEffect } from "react";

/** Mounted once above the routes, so navigating or switching project never interrupts the stream the header reads. */
export function useActivityStream(): void {
  const client = useQueryClient();
  const keys = useQueryKeys();

  // otomat-allow-effect: opens the active host's activity stream and reopens it when the host changes.
  useEffect(() => {
    const subscription = daemon.subscribeActivity({
      onSnapshot: (snapshot) => client.setQueryData(keys.activity, snapshot),
    });
    return () => subscription.close();
  }, [client, keys]);
}
