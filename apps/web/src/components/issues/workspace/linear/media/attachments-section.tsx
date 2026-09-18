import { ErrorState, markdownMediaKind } from "@otomat/ui";
import { useLinearAttachments } from "@web/api/linear/writeback";
import { QueryBoundary } from "@web/components/shell/query-boundary";

import { LinearMedia } from "./linear-media";
import { isLinearUpload } from "./upload";

export function LinearAttachmentsSection({ issueId }: { issueId: string }) {
  const attachments = useLinearAttachments(issueId);
  return (
    <QueryBoundary
      query={attachments}
      pending={null}
      error={
        <ErrorState
          variant="inline"
          title="Couldn’t load attachments"
          onRetry={() => void attachments.refetch()}
        />
      }
    >
      {(list) => {
        const media = list.flatMap((attachment) => {
          const kind = markdownMediaKind(attachment.url);
          return kind === null && !isLinearUpload(attachment.url)
            ? []
            : [{ ...attachment, kind: kind ?? undefined }];
        });
        if (media.length === 0) return null;
        return (
          <section className="flex flex-col gap-2.5">
            <div className="text-xs font-semibold text-text-secondary">
              Attachments <span className="font-normal text-text-tertiary">· {media.length}</span>
            </div>
            {media.map((attachment) => (
              <LinearMedia
                key={attachment.id}
                issueId={issueId}
                href={attachment.url}
                kind={attachment.kind}
                label={attachment.title}
              />
            ))}
          </section>
        );
      }}
    </QueryBoundary>
  );
}
