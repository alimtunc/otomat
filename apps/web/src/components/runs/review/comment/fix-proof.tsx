import type { CommentFixProof as CommentFixProofContract } from "@otomat/domain";
import { Skeleton } from "@otomat/ui";
import { useCommentFixProof } from "@web/api/reviews/queries";
import { FullDeltaLink } from "@web/components/runs/review/comment/full-delta-link";
import { ProofExcerpt } from "@web/components/runs/review/comment/proof-excerpt";
import { QueryBoundary } from "@web/components/shell/query-boundary";

export interface CommentFixProofProps {
  runId: string;
  commentId: string;
}

function ProofBody({ runId, proof }: { runId: string; proof: CommentFixProofContract }) {
  if (proof.state === "unavailable") {
    return <p className="text-xs text-text-tertiary">{proof.reason}</p>;
  }
  if (proof.state === "no_change") {
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-xs text-text-tertiary">{proof.reason}</p>
        <FullDeltaLink runId={runId} session={proof.pass.agent_session_id} />
      </div>
    );
  }
  return <ProofExcerpt runId={runId} proof={proof} />;
}

export function CommentFixProof({ runId, commentId }: CommentFixProofProps) {
  const proof = useCommentFixProof(runId, commentId);
  return (
    <QueryBoundary
      query={proof}
      pending={<Skeleton height={48} />}
      error={<p className="text-xs text-text-tertiary">The fix proof could not be loaded.</p>}
    >
      {(data) => <ProofBody runId={runId} proof={data} />}
    </QueryBoundary>
  );
}
