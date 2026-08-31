import "./strip.css";
import type { PullRequestDetail, RunDetail } from "@otomat/domain";
import { resolveStatus, TONE_TEXT } from "@otomat/ui";
import { NextActionCtaButton } from "@web/components/runs/next-action/cta";
import { runNextAction } from "@web/lib/run/next-action";

export interface NextActionStripProps {
  detail: RunDetail;
  pullRequest: PullRequestDetail | undefined;
}

export function NextActionStrip({ detail, pullRequest }: NextActionStripProps) {
  const action = runNextAction(detail, pullRequest);
  const StatusIcon = resolveStatus("run", detail.run.status).icon;
  return (
    <div
      aria-live="polite"
      className="flex h-10 flex-none items-center border-b border-border-subtle bg-surface-1 px-4.5"
    >
      <div
        key={`${action.kind}:${action.description}`}
        className="otomat-next-action-in flex min-w-0 flex-1 items-center gap-2.5"
      >
        <StatusIcon size={14} aria-hidden className={`shrink-0 ${TONE_TEXT[action.tone]}`} />
        <p className="min-w-0 truncate text-sm text-text-secondary">{action.description}</p>
        {action.cta === null ? null : (
          <NextActionCtaButton
            runId={detail.run.id}
            cta={action.cta}
            size="xs"
            className="ml-auto"
          />
        )}
      </div>
    </div>
  );
}
