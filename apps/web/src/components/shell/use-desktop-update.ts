import type { DesktopUpdateSnapshot } from "@otomat/domain";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryKeys } from "@web/api/query-keys";
import { desktopBridge, requireDesktopBridge } from "@web/lib/desktop-bridge";
import { useEffect, useState } from "react";

export interface DesktopUpdateController {
  /** Null in a browser cockpit, and until the shell has answered once. */
  snapshot: DesktopUpdateSnapshot | null;
  checking: boolean;
  installing: boolean;
  /** Why the shell itself refused; the update's own failure rides on the snapshot. */
  error: string | null;
  check(): void;
  install(): void;
}

/** The main process owns the download and the install, so the pushed state wins over the seed read. */
export function useDesktopUpdate(): DesktopUpdateController {
  const bridge = desktopBridge();
  const [pushed, setPushed] = useState<DesktopUpdateSnapshot | null>(null);
  const seed = useQuery({
    queryKey: queryKeys.desktopUpdate,
    queryFn: () => requireDesktopBridge(bridge).update.snapshot(),
    enabled: bridge !== null,
  });
  const check = useMutation({ mutationFn: () => requireDesktopBridge(bridge).update.check() });
  const install = useMutation({ mutationFn: () => requireDesktopBridge(bridge).update.install() });

  // otomat-allow-effect: subscribe to the main process's update channel and detach on unmount.
  useEffect(() => {
    if (bridge === null) return;
    return bridge.update.onChange(setPushed);
  }, [bridge]);

  return {
    snapshot: pushed ?? seed.data ?? null,
    checking: check.isPending,
    installing: install.isPending,
    error: check.error?.message ?? install.error?.message ?? seed.error?.message ?? null,
    check: () => check.mutate(),
    install: () => install.mutate(),
  };
}
