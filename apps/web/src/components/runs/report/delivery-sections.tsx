import type { RunCompletionReport } from "@otomat/domain";

import { FactEvidence, ReportSection } from "./section";
import { sentence } from "./sentence";

function DiffFacts({ report }: { report: RunCompletionReport }) {
  if (report.diff.state === "not_reported") {
    return <p className="text-sm text-text-tertiary">No diff reported.</p>;
  }
  if (report.diff.state === "unavailable") {
    return <p className="text-sm text-danger">Canonical diff unavailable.</p>;
  }
  if (report.diff.state === "no_changes") {
    return <p className="text-sm text-text-tertiary">No changed files.</p>;
  }
  return (
    <div>
      <p className="mb-3 font-mono text-xs text-text-secondary">
        {report.diff.files.length} files · +{report.diff.additions}/-{report.diff.deletions}
      </p>
      <ul className="space-y-2">
        {report.diff.files.map((file) => (
          <li key={file.path} className="flex min-w-0 items-center gap-2 text-sm">
            <span className="min-w-0 flex-1 truncate font-mono text-xs">{file.path}</span>
            <span className="font-mono text-[10px] text-text-tertiary">
              +{file.additions}/-{file.deletions}
            </span>
            <FactEvidence report={report} evidence={file.evidence[0]} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewAndPublication({ report }: { report: RunCompletionReport }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <div className="flex items-center gap-2">
          <strong>Review · {sentence(report.review.state)}</strong>
          <FactEvidence report={report} evidence={report.review.evidence[0]} />
        </div>
        {report.review.open_comments.map((comment) => (
          <div key={comment.id} className="mt-2 border-l-2 border-iris/35 pl-3">
            <div className="flex items-center gap-2">
              <code className="text-xs">
                {comment.file_path}:{comment.line}
              </code>
              <FactEvidence report={report} evidence={comment.evidence[0]} />
            </div>
            <p className="mt-1 text-text-secondary">{comment.body}</p>
          </div>
        ))}
      </div>
      <div className="border-t border-border-subtle pt-3">
        <div className="flex items-center gap-2">
          <strong>Pull request · {sentence(report.pull_request.state)}</strong>
          <FactEvidence report={report} evidence={report.pull_request.evidence[0]} />
        </div>
        {report.pull_request.state === "reported" ? (
          <div className="mt-1 text-text-secondary">
            <p>
              #{report.pull_request.number ?? "—"} · {report.pull_request.status ?? "not reported"}{" "}
              · {report.pull_request.publication_status ?? "not reported"}
            </p>
            {report.pull_request.error ? (
              <p className="mt-1 text-danger">{report.pull_request.error}</p>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="border-t border-border-subtle pt-3">
        <strong>Linear · {sentence(report.linear.state)}</strong>
        {report.linear.writes.map((write) => (
          <div key={write.id} className="mt-2 flex items-center gap-2 text-text-secondary">
            <span>
              {sentence(write.kind)} · {sentence(write.status)}
              {write.detail ? ` · ${write.detail}` : ""}
              {write.error ? ` · ${write.error}` : ""}
            </span>
            <FactEvidence report={report} evidence={write.evidence[0]} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeliverySections({ report }: { report: RunCompletionReport }) {
  return (
    <>
      <ReportSection title="Files & diff">
        <DiffFacts report={report} />
      </ReportSection>
      <ReportSection title="Review, PR & Linear">
        <ReviewAndPublication report={report} />
      </ReportSection>
    </>
  );
}
