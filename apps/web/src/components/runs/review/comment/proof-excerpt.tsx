import type { CommentFixProof } from "@otomat/domain";
import { Button } from "@otomat/ui";
import { useFileBlobs } from "@web/components/runs/diff/files/use-file-blobs";
import { FullDeltaLink } from "@web/components/runs/review/comment/full-delta-link";
import { ProofDiff } from "@web/components/runs/review/comment/proof-diff";

export interface ProofExcerptProps {
  runId: string;
  proof: Extract<CommentFixProof, { state: "reported" }>;
}

export function ProofExcerpt({ runId, proof }: ProofExcerptProps) {
  const session = proof.pass.agent_session_id;
  const blobs = useFileBlobs({ kind: "run", id: runId }, proof.file, { kind: "session", session });
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs text-text-tertiary">
        Fixed by <span className="text-text-secondary">{proof.pass.step_name}</span>
        {proof.whole_file ? " · whole file delta" : " · hunks touching this comment"}
      </p>
      <ProofDiff file={proof.file} patch={proof.excerpt} context={blobs.context} />
      {blobs.error === null ? null : <p className="text-xs text-danger">{blobs.error}</p>}
      <div className="flex flex-wrap items-center gap-2">
        {blobs.isPending ? (
          <span className="text-xs text-text-tertiary">Loading the file around this patch…</span>
        ) : null}
        {blobs.requested || proof.file.binary ? null : (
          <Button variant="ghost" size="xs" onClick={blobs.request}>
            Expand context
          </Button>
        )}
        <FullDeltaLink runId={runId} session={session} />
      </div>
    </div>
  );
}
