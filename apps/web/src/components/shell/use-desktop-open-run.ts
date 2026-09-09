import { useNavigate } from "@tanstack/react-router";
import { desktopBridge } from "@web/lib/desktop-bridge";
import { useEffect } from "react";

/** The menu bar reopens a run in a cockpit that is already loaded, so the shell navigates to it. */
export function useDesktopOpenRun(): void {
  const bridge = desktopBridge();
  const navigate = useNavigate();

  // otomat-allow-effect: subscribe to the main process's open-run push channel and detach on unmount.
  useEffect(() => {
    if (bridge === null) return;
    return bridge.onOpenRun((runId) => {
      void navigate({ to: "/runs/$runId", params: { runId } });
    });
  }, [bridge, navigate]);
}
