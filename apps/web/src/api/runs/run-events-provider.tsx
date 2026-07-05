import type { EventEnvelope } from "@otomat/domain";
import { useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { mergeEvent } from "@web/api/runs/events";
import { invalidateForEvent } from "@web/api/runs/invalidate-for-event";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

export type RunStreamState = "connecting" | "open" | "closed" | "error";

export interface RunEventStream {
  events: EventEnvelope[];
  state: RunStreamState;
  /** At least one SSE frame failed to decode: the stream is alive but the timeline may have gaps. */
  degraded: boolean;
}

const RunEventsContext = createContext<RunEventStream | null>(null);

export interface RunEventsProviderProps {
  runId: string;
  children: ReactNode;
}

/** One SSE stream per run: feeds the timeline and keeps the run's REST caches honest, torn down on unmount / run change. */
export function RunEventsProvider({ runId, children }: RunEventsProviderProps) {
  const client = useQueryClient();
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [state, setState] = useState<RunStreamState>("connecting");
  const [degraded, setDegraded] = useState(false);
  const closedRef = useRef(false);

  // otomat-allow-effect: open the single daemon SSE run-event stream and tear it down on unmount / run change.
  useEffect(() => {
    closedRef.current = false;
    setEvents([]);
    setState("connecting");
    setDegraded(false);
    const subscription = daemon.subscribeRunEvents(runId, {
      onOpen: () => setState("open"),
      onEvent: (event) => {
        setEvents((current) => mergeEvent(current, event));
        invalidateForEvent(client, runId, event);
      },
      onEnd: () => {
        closedRef.current = true;
        setState("closed");
        client.invalidateQueries({ queryKey: queryKeys.run(runId) });
        client.invalidateQueries({ queryKey: queryKeys.runs });
      },
      onStreamError: () => {
        closedRef.current = true;
        setState("error");
      },
      onError: () => {
        if (!closedRef.current) setState("error");
      },
      onParseError: () => setDegraded(true),
    });
    return () => subscription.close();
  }, [runId, client]);

  return (
    <RunEventsContext.Provider value={{ events, state, degraded }}>
      {children}
    </RunEventsContext.Provider>
  );
}

/** Reads the enclosing RunEventsProvider's stream. Throws when used outside a provider. */
export function useRunEventStream(): RunEventStream {
  const stream = useContext(RunEventsContext);
  if (stream === null) throw new Error("useRunEventStream must be used within a RunEventsProvider");
  return stream;
}
