import { isRunTerminal, type EventEnvelope } from "@otomat/domain";
import { useQuery } from "@tanstack/react-query";
import { daemon } from "@web/api/client";
import { queryKeys } from "@web/api/query-keys";
import { mergeEvent } from "@web/api/runs/events";
import { useEffect, useRef, useState } from "react";

export function useRunsForIssue(issueId: string) {
  return useQuery({
    queryKey: queryKeys.runsForIssue(issueId),
    queryFn: () => daemon.listRuns({ issueId }),
  });
}

export function useRunDetail(runId: string) {
  return useQuery({
    queryKey: queryKeys.run(runId),
    queryFn: () => daemon.getRun(runId),
    refetchInterval: (query) => {
      const status = query.state.data?.run.status;
      return status && isRunTerminal(status) ? false : 1_500;
    },
  });
}

export type RunStreamState = "connecting" | "open" | "closed" | "error";

export interface RunStream {
  events: EventEnvelope[];
  state: RunStreamState;
  /** At least one SSE frame failed to decode: the stream is alive but the timeline may have gaps. */
  degraded: boolean;
}

export function useRunEvents(runId: string): RunStream {
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const [state, setState] = useState<RunStreamState>("connecting");
  const [degraded, setDegraded] = useState(false);
  const closedRef = useRef(false);

  // otomat-allow-effect: open the daemon SSE run-event stream and tear it down on unmount / run change.
  useEffect(() => {
    closedRef.current = false;
    setEvents([]);
    setState("connecting");
    setDegraded(false);
    const subscription = daemon.subscribeRunEvents(runId, {
      onOpen: () => setState("open"),
      onEvent: (event) => setEvents((current) => mergeEvent(current, event)),
      onEnd: () => {
        closedRef.current = true;
        setState("closed");
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
  }, [runId]);

  return { events, state, degraded };
}
