import type { ActivitySnapshot } from "@otomat/domain";
import { useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { useDaemonToken } from "@web/api/use-daemon-token";
import { useQueryKeys } from "@web/api/use-query-keys";
import { useEffect } from "react";

function runStatusKey(snapshot: ActivitySnapshot): string {
  return snapshot.activities
    .flatMap((activity) =>
      activity.kind === "run" ? [`${activity.run_id}:${activity.status}`] : [],
    )
    .toSorted()
    .join(",");
}

/** Mounted once above the routes, so navigating or switching project never interrupts the stream the header reads. */
export function useActivityStream(): void {
  const client = useQueryClient();
  const keys = useQueryKeys();
  const token = useDaemonToken();

  // otomat-allow-effect: opens the active host's activity stream and reopens it when the host or its token changes.
  useEffect(() => {
    const cached = client.getQueryData<ActivitySnapshot>(keys.activity);
    let seen = cached === undefined ? undefined : runStatusKey(cached);
    const subscription = daemon.subscribeActivity({
      onSnapshot: (snapshot) => {
        client.setQueryData(keys.activity, snapshot);
        const previous = seen;
        seen = runStatusKey(snapshot);
        if (previous === undefined || previous === seen) return;
        void client.invalidateQueries({ queryKey: keys.issues });
        void client.invalidateQueries({ queryKey: keys.runs });
        void client.invalidateQueries({ queryKey: keys.conversations });
      },
    });
    return () => subscription.close();
  }, [client, keys, token]);
}
