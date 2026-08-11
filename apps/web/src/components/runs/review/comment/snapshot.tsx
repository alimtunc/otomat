import { Button } from "@otomat/ui";
import { useState } from "react";

const PREVIEW_LINES = 6;

export interface CommentSnapshotProps {
  snapshot: string;
}

export function CommentSnapshot({ snapshot }: CommentSnapshotProps) {
  const [expanded, setExpanded] = useState(false);
  if (snapshot === "") return null;

  const lines = snapshot.split("\n");
  const hidden = lines.length - PREVIEW_LINES;
  const shown = expanded ? lines : lines.slice(0, PREVIEW_LINES);
  return (
    <div className="flex flex-col gap-1">
      <pre className="overflow-x-auto rounded-sm border border-border-subtle bg-surface-1 p-2 font-mono text-xs text-text-secondary">
        {shown.join("\n")}
      </pre>
      {hidden > 0 ? (
        <Button
          variant="ghost"
          size="xs"
          className="self-start"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? "Show less" : `Show ${hidden} more lines`}
        </Button>
      ) : null}
    </div>
  );
}
