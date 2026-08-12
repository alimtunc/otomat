import { Button, Icon } from "@otomat/ui";
import { Link } from "@tanstack/react-router";
import { AddStepDialog } from "@web/components/runs/actions/add-step-dialog";
import { RunActionsMenu } from "@web/components/runs/actions/run-actions-menu";

export interface RunActionButtonsProps {
  runId: string;
  issueId: string;
  stretch?: boolean;
}

/** The cockpit's action row: read the diff, extend the open cycle, or act on the run itself. */
export function RunActionButtons({ runId, issueId, stretch = false }: RunActionButtonsProps) {
  const className = stretch ? "flex-1" : undefined;

  return (
    <>
      <Button
        size="sm"
        className={className}
        render={
          <Link to="/runs/$runId/diff" params={{ runId }}>
            <Icon name="git-compare" aria-hidden />
            Diff
          </Link>
        }
      />
      <AddStepDialog issueId={issueId} stretch={stretch} />
      <RunActionsMenu runId={runId} stretch={stretch} />
    </>
  );
}
