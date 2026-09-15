import type { DiffMediaType } from "@otomat/domain";
import { cn } from "@otomat/ui";

export interface MediaBlobProps {
  data: string;
  mediaType: DiffMediaType;
  label: string;
  className?: string;
}

export function MediaBlob({ data, mediaType, label, className }: MediaBlobProps) {
  const source = `data:${mediaType};base64,${data}`;
  const frame = cn("rounded-md border border-border-subtle bg-surface-1 object-contain", className);
  return mediaType.startsWith("image/") ? (
    <img src={source} alt={label} loading="lazy" decoding="async" className={frame} />
  ) : (
    <video
      src={source}
      aria-label={label}
      controls
      playsInline
      preload="metadata"
      className={frame}
    />
  );
}
