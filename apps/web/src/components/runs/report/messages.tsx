import type { RunCompletionReport } from "@otomat/domain";

import { FactEvidence, ReportSection } from "./section";

export function ReportMessages({ report }: { report: RunCompletionReport }) {
  const messages = [...report.errors, ...report.notices];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ReportSection title="Errors & interruptions">
        {messages.length === 0 ? (
          <p className="text-sm text-text-tertiary">None reported.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {messages.map((message) => (
              <li
                key={`${message.code}-${message.message}-${JSON.stringify(message.evidence)}`}
                className="flex items-start gap-2"
              >
                <span className="min-w-0 flex-1">{message.message}</span>
                <FactEvidence report={report} evidence={message.evidence[0]} />
              </li>
            ))}
          </ul>
        )}
      </ReportSection>
      <ReportSection title="Next actions">
        {report.next_actions.length === 0 ? (
          <p className="text-sm text-text-tertiary">None reported.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {report.next_actions.map((action) => (
              <li
                key={`${action.code}-${action.message}-${JSON.stringify(action.evidence)}`}
                className="flex items-start gap-2"
              >
                <span className="min-w-0 flex-1">{action.message}</span>
                <FactEvidence report={report} evidence={action.evidence[0]} />
              </li>
            ))}
          </ul>
        )}
      </ReportSection>
    </div>
  );
}
