import type { EventEnvelope } from "@otomat/domain";
import { asNumber, asString } from "@web/lib/coerce";

export function PullRequestDetail({ event }: { event: EventEnvelope }) {
  const url = asString(event.payload["url"]);
  const number = asNumber(event.payload["number"]);
  const status = asString(event.payload["status"]);
  return (
    <span className="mt-1 inline-flex items-center gap-2 text-xs">
      {status ? <span className="text-text-secondary">{status}</span> : null}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-iris-text hover:underline">
          {number !== null ? `#${number}` : "Open on GitHub"} ↗
        </a>
      ) : null}
    </span>
  );
}
