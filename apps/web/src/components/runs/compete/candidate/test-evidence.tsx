import { cn } from "@otomat/ui";
import { EvidenceSection } from "@web/components/runs/compete/evidence-section";
import type { TestEvidence } from "@web/lib/test-evidence";

function testOutcomeClass(outcome: TestEvidence["outcome"]): string {
  switch (outcome) {
    case "failed":
      return "text-danger";
    case "passed":
      return "text-success";
    default:
      return "text-text-secondary";
  }
}

export function CandidateTestEvidence({ tests }: { tests: readonly TestEvidence[] }) {
  const sectionLabel = `Test evidence · ${tests.length}`;
  if (tests.length === 0) {
    return (
      <EvidenceSection label={sectionLabel} empty="No explicit test command evidence reported." />
    );
  }
  return (
    <EvidenceSection label={sectionLabel}>
      <div className="max-h-40 space-y-2 overflow-y-auto">
        {tests.map((test) => (
          <div
            key={test.id}
            className="rounded-md border border-border-subtle bg-surface p-2 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn("font-medium", testOutcomeClass(test.outcome))}>
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
    </EvidenceSection>
  );
}
