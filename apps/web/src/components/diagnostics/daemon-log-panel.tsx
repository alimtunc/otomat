import type { ErrorDiagnostic } from "@otomat/domain";

export interface DaemonLogPanelProps {
  diagnostic: ErrorDiagnostic;
  pending: boolean;
  error: Error | null;
}

const PANEL_CLASS =
  "max-h-56 overflow-auto rounded-md border border-border-subtle bg-background p-2.5 " +
  "font-mono text-micro leading-relaxed text-text-secondary";

function unavailableNote({ diagnostic, pending, error }: DaemonLogPanelProps): string | null {
  if (pending) return `Asking ${diagnostic.host.label} for its log excerpt…`;
  if (error !== null) return `${diagnostic.host.label} could not be asked: ${error.message}`;
  if (diagnostic.request === null || diagnostic.request.correlation_id === null) {
    return "This response carried no correlation id, so no host log can be matched to it.";
  }
  const entries = diagnostic.daemon_log;
  if (entries === null || entries.length === 0) {
    return `${diagnostic.host.label} kept no log line for this request.`;
  }
  return null;
}

export function DaemonLogPanel(props: DaemonLogPanelProps) {
  if (props.diagnostic.category !== "daemon") return null;
  const unavailable = unavailableNote(props);
  const entries = props.diagnostic.daemon_log ?? [];
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-text-tertiary">Host log excerpt (redacted)</span>
      {unavailable === null ? (
        <ul className={PANEL_CLASS}>
          {entries.map((entry, index) => (
            <li key={`${entry.at}-${index}`} className="whitespace-pre-wrap break-all">
              <span className="text-text-tertiary">{entry.at}</span> {entry.message}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-text-secondary">{unavailable}</p>
      )}
    </div>
  );
}
