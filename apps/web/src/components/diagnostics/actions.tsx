import type { ErrorDiagnostic } from "@otomat/domain";
import { Button, CopyButton, toast } from "@otomat/ui";
import { exportDiagnostic } from "@web/lib/diagnostics/export";
import { useState } from "react";

export interface DiagnosticActionsProps {
  diagnostic: ErrorDiagnostic;
  retryLabel: string;
  onRetry: () => void;
  onBack: (() => void) | null;
  onReport: () => void;
}

function reason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function DiagnosticActions({
  diagnostic,
  retryLabel,
  onRetry,
  onBack,
  onReport,
}: DiagnosticActionsProps) {
  const [exporting, setExporting] = useState(false);
  const serialized = `${JSON.stringify(diagnostic, null, 2)}\n`;

  async function exportBundle() {
    setExporting(true);
    try {
      const result = await exportDiagnostic(diagnostic);
      if (result.status === "written") toast.success(`Support bundle written to ${result.path}`);
      if (result.status === "failed") toast.error(result.message);
    } catch (error) {
      toast.error(`The support bundle could not be written: ${reason(error)}`);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
      {onBack === null ? null : (
        <Button variant="outline" size="sm" onClick={onBack}>
          Go back
        </Button>
      )}
      <Button variant="outline" size="sm" disabled={exporting} onClick={() => void exportBundle()}>
        Export support bundle
      </Button>
      <Button variant="outline" size="sm" onClick={onReport}>
        Report problem
      </Button>
      <CopyButton
        value={serialized}
        label="Copy diagnostic"
        copiedLabel="Diagnostic copied"
        showLabel
        onError={(error) => toast.error(`The diagnostic could not be copied: ${reason(error)}`)}
      />
    </div>
  );
}
