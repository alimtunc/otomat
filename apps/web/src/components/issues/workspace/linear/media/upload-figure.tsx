import { ErrorState, MarkdownLink, Skeleton, type MarkdownMediaProps } from "@otomat/ui";
import { linearErrorMessage } from "@web/api/linear/mutations";
import { useLinearMedia } from "@web/api/linear/writeback";

import { formatBytes } from "./format-bytes";
import { MediaLightbox } from "./lightbox";
import { uploadFileName } from "./upload";

export interface UploadFigureProps extends MarkdownMediaProps {
  issueId: string;
}

export function UploadFigure({ issueId, href, kind, label }: UploadFigureProps) {
  const query = useLinearMedia(issueId, href);
  const name = uploadFileName(href);
  const readable = label?.trim() || name || (kind === "video" ? "Video" : "Image");
  const openInLinear = <MarkdownLink href={href}>Open in Linear</MarkdownLink>;

  if (query.isPending)
    return <Skeleton height={kind === "video" ? 180 : 120} width="min(100%, 36rem)" />;
  if (query.isError) {
    return (
      <ErrorState
        variant="inline"
        title={readable}
        description={
          <>
            {linearErrorMessage(query.error)} {openInLinear}
          </>
        }
        onRetry={() => void query.refetch()}
      />
    );
  }

  const { src, type, size } = query.data;
  const details = [readable, name !== readable ? name : null, type, formatBytes(size)]
    .filter((part) => part !== null && part !== "")
    .join(" · ");
  return (
    <figure className="flex min-w-0 flex-col items-start gap-1.5">
      {type.startsWith("video/") ? (
        <video
          src={src}
          aria-label={readable}
          controls
          playsInline
          preload="metadata"
          className="max-h-[36rem] max-w-full rounded-md border border-border-subtle"
        />
      ) : (
        <MediaLightbox src={src} label={readable} />
      )}
      <figcaption className="flex flex-wrap items-center gap-x-2 text-xs text-text-tertiary">
        <span>{details}</span>
        {openInLinear}
      </figcaption>
    </figure>
  );
}
