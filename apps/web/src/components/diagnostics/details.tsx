import type { ErrorDiagnostic } from "@otomat/domain";
import { diagnosticSummaryRows } from "@web/lib/diagnostics/summary-rows";

const TRACE_CLASS =
  "max-h-56 overflow-auto whitespace-pre-wrap rounded-md border border-border-subtle " +
  "bg-background p-2.5 font-mono text-micro leading-relaxed text-text-secondary";

function Trace({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-text-tertiary">{label}</span>
      <pre className={TRACE_CLASS}>{value}</pre>
    </div>
  );
}

export function DiagnosticDetails({ diagnostic }: { diagnostic: ErrorDiagnostic }) {
  return (
    <div className="flex flex-col gap-3.5">
      <dl className="flex flex-col gap-1.5 text-xs">
        {diagnosticSummaryRows(diagnostic).map((row) => (
          <div key={row.label} className="flex gap-3">
            <dt className="w-32 flex-none text-text-tertiary">{row.label}</dt>
            <dd className="min-w-0 flex-1 break-all font-mono text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
      <Trace label="Message" value={diagnostic.message} />
      {diagnostic.stack === null ? null : <Trace label="Stack" value={diagnostic.stack} />}
      {diagnostic.component_stack === null ? null : (
        <Trace label="Component stack" value={diagnostic.component_stack} />
      )}
    </div>
  );
}
