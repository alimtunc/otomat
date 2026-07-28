import type { EventEnvelope } from "@otomat/domain";
import { createContext, useContext } from "react";

export type RunStreamState = "connecting" | "open" | "closed" | "error";

export interface RunEventStream {
  events: EventEnvelope[];
  state: RunStreamState;
  /** At least one SSE frame failed to decode: the stream is alive but the timeline may have gaps. */
  degraded: boolean;
}

export const RunEventsContext = createContext<RunEventStream | null>(null);

/** Reads the enclosing RunEventsProvider's stream. Throws when used outside a provider. */
export function useRunEventStream(): RunEventStream {
  const stream = useContext(RunEventsContext);
  if (stream === null) throw new Error("useRunEventStream must be used within a RunEventsProvider");
  return stream;
}
