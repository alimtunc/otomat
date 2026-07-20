import type { EventEnvelope } from "@otomat/domain";
import { JsonDisclosure } from "@web/components/runs/timeline/event-detail/json-disclosure";

export function ToolCallDetail({ event }: { event: EventEnvelope }) {
  const args = event.payload["args"];
  const result = event.payload["result"];
  const isError = event.payload["is_error"] === true;
  return (
    <div className="flex flex-col">
      {isError ? <span className="mt-0.5 text-xs text-danger">tool reported an error</span> : null}
      {args !== undefined && args !== null ? <JsonDisclosure label="args" value={args} /> : null}
      {result !== undefined && result !== null ? (
        <JsonDisclosure label="result" value={result} />
      ) : null}
    </div>
  );
}
