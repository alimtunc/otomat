import { useState } from "react";

import {
  markdownMediaKind,
  safeRemoteMediaHref,
  type MarkdownMediaKind,
} from "../lib/markdown/media";
import { MarkdownLink } from "./markdown-link";

export interface MarkdownMediaProps {
  href: string;
  kind?: MarkdownMediaKind;
  label?: string | null;
}

export function MarkdownMedia({ href, kind, label }: MarkdownMediaProps) {
  const destination = safeRemoteMediaHref(href);
  const mediaKind = markdownMediaKind(href, kind ?? null);
  const [failed, setFailed] = useState(false);
  const readableLabel =
    label?.trim() || (mediaKind === "video" ? "Video attachment" : "Image attachment");

  if (destination === null || mediaKind === null || failed) {
    return <MarkdownLink href={href}>{readableLabel}</MarkdownLink>;
  }

  return (
    <figure className="flex min-w-0 flex-col items-start gap-1.5">
      {mediaKind === "image" ? (
        <img
          src={destination}
          alt={readableLabel}
          loading="lazy"
          decoding="async"
          className="max-h-[36rem] max-w-full rounded-md border border-border-subtle object-contain"
          onError={() => setFailed(true)}
        />
      ) : (
        <video
          src={destination}
          aria-label={readableLabel}
          controls
          playsInline
          preload="metadata"
          className="max-h-[36rem] max-w-full rounded-md border border-border-subtle"
          onError={() => setFailed(true)}
        />
      )}
      <figcaption className="text-xs text-text-tertiary">
        <MarkdownLink href={destination}>{readableLabel}</MarkdownLink>
      </figcaption>
    </figure>
  );
}
