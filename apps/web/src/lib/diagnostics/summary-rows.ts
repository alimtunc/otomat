import type { ErrorDiagnostic, ErrorDiagnosticCategory } from "@otomat/domain";

export interface DiagnosticSummaryRow {
  label: string;
  value: string;
}

const CATEGORY_LABELS = {
  renderer: "Renderer — this app, not the daemon",
  daemon: "Daemon — the active execution host",
  transport: "Transport — the host was never reached",
} satisfies Record<ErrorDiagnosticCategory, string>;

export function diagnosticSummaryRows(diagnostic: ErrorDiagnostic): DiagnosticSummaryRow[] {
  const rows: DiagnosticSummaryRow[] = [
    { label: "Error id", value: diagnostic.id },
    { label: "Category", value: CATEGORY_LABELS[diagnostic.category] },
    { label: "When", value: diagnostic.occurred_at },
    { label: "Route", value: diagnostic.route },
    { label: "Execution host", value: diagnostic.host.label },
  ];
  if (diagnostic.app !== null) {
    const app = diagnostic.app;
    rows.push({ label: "App", value: `${app.version} · ${app.commit} · ${app.channel}` });
  }
  if (diagnostic.daemon !== null) {
    const build = diagnostic.daemon.build ?? "unstamped";
    rows.push({ label: "Daemon", value: `${diagnostic.daemon.version} · ${build}` });
  }
  if (diagnostic.request !== null) {
    const request = diagnostic.request;
    const status = request.status === null ? "no response" : String(request.status);
    rows.push({ label: "Request", value: `${request.method} ${request.path} → ${status}` });
    rows.push({ label: "Correlation id", value: request.correlation_id ?? "none" });
  }
  return rows;
}
