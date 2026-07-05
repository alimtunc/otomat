export interface EmptyTimelineContent {
  tone: "error" | "neutral";
  title: string;
  description: string;
}

export function emptyTimelineContent(isError: boolean, degraded: boolean): EmptyTimelineContent {
  if (isError) {
    return {
      tone: "error",
      title: "Stream interrupted",
      description: "The event stream dropped. It reconnects automatically.",
    };
  }
  if (degraded) {
    return {
      tone: "error",
      title: "Events unreadable",
      description:
        "Events arrived but could not be decoded. The daemon and cockpit may be out of sync.",
    };
  }
  return {
    tone: "neutral",
    title: "Waiting to start",
    description: "No events yet. The run timeline streams from the daemon over SSE.",
  };
}
