import type { RunStreamState } from "@web/api/runs/run-event-stream";

export const STREAM_LABEL = {
  connecting: "connecting…",
  open: "following updates",
  closed: "stream ended",
  error: "stream error",
} satisfies Record<RunStreamState, string>;
