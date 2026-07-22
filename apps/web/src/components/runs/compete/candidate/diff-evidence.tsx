import { Skeleton } from "@otomat/ui";
import { useCompeteCandidateDiff } from "@web/api/runs/queries";

export function CandidateDiffEvidence({
  runId,
  groupId,
  stepId,
}: {
  runId: string;
  groupId: string;
  stepId: string;
}) {
  const diff = useCompeteCandidateDiff(runId, groupId, stepId);
  if (diff.isPending) {
    return (
      <div className="flex flex-col gap-1.5">
        <Skeleton height={12} width="72%" />
        <Skeleton height={12} width="48%" />
      </div>
    );
  }
  if (diff.isError) {
    return <p className="text-xs text-danger">Diff evidence could not be loaded.</p>;
  }
  if (diff.data.diff === null) {
    return (
      <p className="text-xs text-text-tertiary">No git worktree evidence for this candidate.</p>
    );
  }

  const candidateDiff = diff.data.diff;
  return (
    <div className="rounded-md border border-border-subtle bg-surface p-2">
      <div className="flex items-center gap-2 text-xs">
        <span>{candidateDiff.files.length} files</span>
        <span className="text-success">+{candidateDiff.additions}</span>
        <span className="text-danger">−{candidateDiff.deletions}</span>
      </div>
      {candidateDiff.files.length === 0 ? (
        <p className="mt-1 text-xs text-text-tertiary">No changes produced.</p>
      ) : (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer select-none text-iris-text">Inspect patch</summary>
          <div className="mt-2 max-h-44 space-y-2 overflow-auto">
            {candidateDiff.files.map((file) => (
              <div key={file.path}>
                <p className="truncate font-mono text-[10px] text-text-secondary">{file.path}</p>
                <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-background p-2 font-mono text-[10px] leading-4 text-text-secondary">
                  {file.patch ?? "Binary file or patch unavailable."}
                </pre>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
