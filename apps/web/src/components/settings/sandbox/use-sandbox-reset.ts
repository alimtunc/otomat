import { desktopBridge } from "@web/lib/desktop-bridge";
import { useState } from "react";

export interface UseSandboxResetResult {
  /** True when the bridge exists and this build is a packaged preview. */
  available: boolean;
  pending: boolean;
  error: string | null;
  reset(): void;
}

export function useSandboxReset(): UseSandboxResetResult {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bridge = desktopBridge();
  const reset = (): void => {
    if (bridge === null || pending) return;
    setPending(true);
    setError(null);
    void bridge.sandbox.reset().then(
      (result) => {
        // On success the main process reloads this window; stay pending until it does.
        if (!result.ok) {
          setError(result.message);
          setPending(false);
        }
      },
      (cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "The sandbox reset failed.");
        setPending(false);
      },
    );
  };
  return { available: bridge !== null && bridge.preview, pending, error, reset };
}
