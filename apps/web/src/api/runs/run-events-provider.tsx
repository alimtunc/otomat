import type { EventEnvelope } from "@otomat/domain";
import { useQueryClient } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { mergeEvent, mergeEventWindow } from "@web/api/runs/events";
import { invalidateForEvent } from "@web/api/runs/invalidate-for-event";
import { RunEventsContext, type RunStreamState } from "@web/api/runs/run-event-stream";
import { useEventHistory } from "@web/api/runs/use-event-history";
import { useEffect, useRef, useState, type ReactNode } from "react";

export interface RunEventsProviderProps {
  runId: string;
  children: ReactNode;
}

export function RunEventsProvider({ runId, children }: RunEventsProviderProps) {
  const client = useQueryClient();
  const history = useEventHistory(runId);
  const [live, setLive] = useState<EventEnvelope[]>([]);
  const [state, setState] = useState<RunStreamState>("connecting");
  const [degraded, setDegraded] = useState(false);
  const closedRef = useRef(false);
  const anchored = history.status === "ready";
  const { tailSeq } = history;

  // otomat-allow-effect: open the single daemon SSE run-event stream and tear it down on unmount / run change.
  useEffect(() => {
    closedRef.current = false;
    setLive([]);
    setState("connecting");
    setDegraded(false);
    if (!anchored) return;
    const subscription = daemon.subscribeRunEvents(runId, {
      afterSeq: tailSeq ?? undefined,
      onOpen: () => setState("open"),
      onEvent: (event) => {
        setLive((current) => mergeEvent(current, event));
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
  }, [runId, client, anchored, tailSeq]);

  const events = mergeEventWindow(history.events, live);

  return (
    <RunEventsContext.Provider value={{ events, state, degraded, history }}>
      {children}
    </RunEventsContext.Provider>
  );
}
