import type { PullRequestDetail, RunDetail } from "@otomat/domain";
import { resolveStatus, TONE_TEXT } from "@otomat/ui";
import { NextActionCtaButton } from "@web/components/runs/next-action/cta";
import { runNextAction } from "@web/lib/run/next-action";

export interface NextActionCardProps {
  detail: RunDetail;
  pullRequest: PullRequestDetail | undefined;
}

export function NextActionCard({ detail, pullRequest }: NextActionCardProps) {
  const action = runNextAction(detail, pullRequest);
  const StatusIcon = resolveStatus("run", detail.run.status).icon;
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-3.5">
      <p className="flex items-start gap-2 text-sm text-text-secondary">
        <StatusIcon size={14} aria-hidden className={`mt-0.5 shrink-0 ${TONE_TEXT[action.tone]}`} />
        <span>{action.description}</span>
      </p>
      {action.cta === null ? null : (
        <NextActionCtaButton
          runId={detail.run.id}
          cta={action.cta}
          size="sm"
          className="mt-2.5 w-full"
        />
      )}
    </div>
  );
}
