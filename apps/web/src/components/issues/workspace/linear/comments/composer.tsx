import { Button, Textarea } from "@otomat/ui";
import { usePublishLinearComment } from "@web/api/linear/writeback";
import { useRef, useState } from "react";

export function Composer({
  issueId,
  runId,
  parentId,
  placeholder,
  onPosted,
}: {
  issueId: string;
  runId: string | null;
  parentId: string | null;
  placeholder: string;
  onPosted?: () => void;
}) {
  const publish = usePublishLinearComment(issueId);
  const [body, setBody] = useState("");
  const clientId = useRef<string | null>(null);
  if (clientId.current === null) clientId.current = crypto.randomUUID();
  const currentClientId = clientId.current;

  return (
    <div className="flex flex-col gap-1.5">
      <Textarea
        rows={2}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="text-sm"
      />
      {body.trim().length > 0 ? (
        <Button
          size="xs"
          variant="primary"
          className="self-end"
          loading={publish.isPending}
          disabled={publish.isPending}
          onClick={() =>
            publish.mutate(
              {
                client_id: currentClientId,
                body: body.trim(),
                run_id: runId,
                parent_id: parentId,
              },
              {
                onSuccess: () => {
                  setBody("");
                  clientId.current = crypto.randomUUID();
                  onPosted?.();
                },
              },
            )
          }
        >
          {parentId === null ? "Comment" : "Post reply"}
        </Button>
      ) : null}
    </div>
  );
}
