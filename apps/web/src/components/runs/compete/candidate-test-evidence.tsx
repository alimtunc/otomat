import { cn } from "@otomat/ui";
import { EvidenceSection } from "@web/components/runs/compete/evidence-section";
import { testOutcomeClass, type TestEvidence } from "@web/components/runs/compete/test-evidence";

export function CandidateTestEvidence({ tests }: { tests: readonly TestEvidence[] }) {
  const label = `Test evidence · ${tests.length}`;
  if (tests.length === 0) {
    return <EvidenceSection label={label} empty="No explicit test command evidence reported." />;
  }
  return (
    <EvidenceSection label={label}>
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
