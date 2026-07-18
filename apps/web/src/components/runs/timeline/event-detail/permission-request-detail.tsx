import type { EventEnvelope } from "@otomat/domain";
import { asString } from "@web/lib/coerce";

export function PermissionRequestDetail({ event }: { event: EventEnvelope }) {
  const action = asString(event.payload["action"]);
  const path = asString(event.payload["path"]);
  return (
    <div className="mt-1 flex max-w-120 flex-col gap-1 rounded-md border border-warning bg-warning-bg px-3 py-2 text-xs">
      <span className="font-medium text-warning">
        Permission requested
        {action ? (
          <>
            {" "}
            · <span className="font-mono">{action}</span>
          </>
        ) : null}
      </span>
      {path ? <span className="font-mono text-text-secondary">{path}</span> : null}
      <span className="text-text-tertiary">
        Read-only — respond from the agent, permission decisions are not available here yet.
      </span>
    </div>
  );
}
