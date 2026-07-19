import { cn } from "@otomat/ui";
import type { TestEvidence } from "@web/components/runs/compete/test-evidence";

function outcomeClass(outcome: TestEvidence["outcome"]): string {
  if (outcome === "failed") return "text-danger";
  if (outcome === "passed") return "text-success";
  return "text-text-secondary";
}

export function CandidateTestEvidence({ tests }: { tests: readonly TestEvidence[] }) {
  return (
    <section>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-tertiary">
        Test evidence · {tests.length}
      </p>
      {tests.length === 0 ? (
        <p className="text-xs text-text-tertiary">No explicit test command evidence reported.</p>
      ) : (
        <div className="max-h-40 space-y-2 overflow-y-auto">
          {tests.map((test) => (
            <div
              key={test.id}
              className="rounded-md border border-border-subtle bg-surface p-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className={cn("font-medium", outcomeClass(test.outcome))}>
                  Test {test.outcome}
                </span>
                {test.exitCode !== null ? (
                  <span className="font-mono text-[10px] text-text-tertiary">
                    exit {test.exitCode}
                  </span>
                ) : null}
              </div>
              <code className="mt-1 block break-words text-[10px] text-text-secondary">
                {test.command}
              </code>
              {test.output ? (
                <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap font-mono text-[10px] text-text-tertiary">
                  {test.output}
                </pre>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
