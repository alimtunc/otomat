import {
  Button,
  cn,
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
  FOCUS_RING,
  Icon,
} from "@otomat/ui";
import { CenteredState } from "@web/components/shell/centered-state";
import { describeErrorCategory } from "@web/lib/diagnostics/category-copy";
import { useState } from "react";

import { DiagnosticActions } from "./actions";
import { DaemonLogPanel } from "./daemon-log-panel";
import { DiagnosticDetails } from "./details";
import { ReportProblemDialog } from "./report-dialog";
import { useErrorDiagnostic } from "./use-error-diagnostic";

export interface ErrorReportProps {
  error: unknown;
  /** What the caller was doing, when it knows it — shown above the classified title. */
  context?: string;
  componentStack?: string | null;
  occurredAt?: Date;
  retryLabel?: string;
  onRetry: () => void;
  onBack?: () => void;
}

const CARD_CLASS =
  "flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-border-subtle bg-card p-5";
const TRIGGER_CLASS =
  "h-8 w-full justify-start gap-1.5 rounded-md px-2 text-xs font-medium text-text-secondary";

/**
 * The one error surface: it classifies the incident, names the layer it came from, offers the
 * copy, export and report actions, and always leaves a way back into the app.
 */
export function ErrorReport({
  error,
  context,
  componentStack = null,
  occurredAt,
  retryLabel = "Retry",
  onRetry,
  onBack,
}: ErrorReportProps) {
  const [report, setReport] = useState(false);
  const { diagnostic, logPending, logError } = useErrorDiagnostic({
    error,
    componentStack,
    occurredAt,
  });
  const copy = describeErrorCategory(diagnostic);

  return (
    <CenteredState>
      <div className={CARD_CLASS}>
        <div className="flex flex-col gap-1.5">
          {context === undefined ? null : (
            <span className="text-xs text-text-tertiary">{context}</span>
          )}
          <h2 className="flex items-center gap-2 text-md font-semibold text-foreground">
            <Icon name="alert-triangle" aria-hidden className="h-4.25 w-4.25 text-danger" />
            {copy.title}
          </h2>
          <p className="text-sm text-text-secondary">{copy.description}</p>
          <p className="font-mono text-xs text-text-tertiary">{diagnostic.id}</p>
        </div>

        <DaemonLogPanel diagnostic={diagnostic} pending={logPending} error={logError} />

        <Collapsible className="group/details flex flex-col gap-2.5">
          <CollapsibleTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(TRIGGER_CLASS, FOCUS_RING)}
              />
            }
          >
            <Icon
              name="chevron-down"
              aria-hidden
              className="h-3.5 w-3.5 group-data-[closed]/details:-rotate-90"
            />
            Details
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <DiagnosticDetails diagnostic={diagnostic} />
          </CollapsiblePanel>
        </Collapsible>

        <DiagnosticActions
          diagnostic={diagnostic}
          retryLabel={retryLabel}
          onRetry={onRetry}
          onBack={onBack ?? null}
          onReport={() => setReport(true)}
        />
        <ReportProblemDialog diagnostic={diagnostic} open={report} onOpenChange={setReport} />
      </div>
    </CenteredState>
  );
}
