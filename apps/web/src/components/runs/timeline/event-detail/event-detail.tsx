import type { EventEnvelope } from "@otomat/domain";
import { DiffUpdatedDetail } from "@web/components/runs/timeline/event-detail/diff-updated-detail";
import { LifecycleDetail } from "@web/components/runs/timeline/event-detail/lifecycle-detail";
import { PermissionRequestDetail } from "@web/components/runs/timeline/event-detail/permission-request-detail";
import { PullRequestDetail } from "@web/components/runs/timeline/event-detail/pull-request-detail";
import { ToolCallDetail } from "@web/components/runs/timeline/event-detail/tool-call-detail";
import { UsageDetail } from "@web/components/runs/timeline/event-detail/usage-detail";
import type { ReactNode } from "react";

/** Per-type readable detail rendered under an event's summary row; null when the payload has nothing beyond the summary. */
export function eventDetail(event: EventEnvelope): ReactNode {
  switch (event.type) {
    case "runtime.tool_call":
      return <ToolCallDetail event={event} />;
    case "runtime.permission_request":
      return <PermissionRequestDetail event={event} />;
    case "runtime.usage":
      return <UsageDetail event={event} />;
    case "git.diff_updated":
      return <DiffUpdatedDetail event={event} />;
    case "run.lifecycle":
      return <LifecycleDetail event={event} />;
    case "pr.created":
    case "pr.updated":
      return <PullRequestDetail event={event} />;
    default:
      return null;
  }
}
