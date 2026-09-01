import type { PullRequestDetail, RunDetail } from "@otomat/domain";
import { NextActionCtaButton } from "@web/components/runs/next-action/cta";
import { runNextAction } from "@web/lib/run/next-action";

export interface NextActionCardProps {
  detail: RunDetail;
  pullRequest: PullRequestDetail | undefined;
}

export function NextActionCard({ detail, pullRequest }: NextActionCardProps) {
  const action = runNextAction(detail, pullRequest);
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-1 p-3.5">
      <p className="text-sm text-text-secondary">{action.description}</p>
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
