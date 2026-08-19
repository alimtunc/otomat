import type { RunStreamState } from "@web/api/runs/run-event-stream";

export const STREAM_LABEL = {
  connecting: "connecting…",
  open: "live",
  closed: "stream ended",
  error: "stream error",
} satisfies Record<RunStreamState, string>;
