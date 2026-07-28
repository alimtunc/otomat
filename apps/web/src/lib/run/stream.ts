import type { RunStreamState } from "@web/api/runs/run-events-provider";

export const STREAM_LABEL: Record<RunStreamState, string> = {
  connecting: "connecting…",
  open: "live",
  closed: "stream ended",
  error: "stream error",
};
