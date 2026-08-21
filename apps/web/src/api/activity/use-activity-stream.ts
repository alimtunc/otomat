import { useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { useEffect } from "react";

/** Mounted once above the routes, so navigating or switching project never interrupts the stream the header reads. */
export function useActivityStream(): void {
  const client = useQueryClient();

  // otomat-allow-effect: opens the daemon's activity stream and tears it down with the app.
  useEffect(() => {
    const subscription = daemon.subscribeActivity({
      onSnapshot: (snapshot) => client.setQueryData(queryKeys.activity, snapshot),
    });
    return () => subscription.close();
  }, [client]);
}
