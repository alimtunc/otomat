import type { LinearCommentContract } from "@otomat/domain";
import { useState } from "react";

import { Card } from "./card";
import { Composer } from "./composer";

export function Thread({
  root,
  replies,
  issueId,
  runId,
}: {
  root: LinearCommentContract;
  replies: LinearCommentContract[];
  issueId: string;
  runId: string | null;
}) {
  const [replying, setReplying] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <Card comment={root} onReply={() => setReplying(true)} />
      {replies.length > 0 || replying ? (
        <div className="flex flex-col gap-2 border-l-2 border-border-subtle pl-3">
          {replies.map((reply) => (
            <Card key={reply.id} comment={reply} />
          ))}
          {replying ? (
            <Composer
              issueId={issueId}
              runId={runId}
              parentId={root.id}
              placeholder={`Reply to ${root.author_name ?? "this comment"}…`}
              onPosted={() => setReplying(false)}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
