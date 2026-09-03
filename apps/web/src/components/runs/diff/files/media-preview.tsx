import type { DiffFileBlob } from "@otomat/domain";
import type { FileMediaContext } from "@web/components/runs/diff/files/use-file-blobs";

type MediaBlob = Extract<DiffFileBlob, { kind: "media" }>;

export interface DiffMediaPreviewProps {
  path: string;
  media: FileMediaContext;
}

function mediaSource(blob: MediaBlob): string {
  return `data:${blob.media_type};base64,${blob.data}`;
}

export function DiffMediaPreview({ path, media }: DiffMediaPreviewProps) {
  const sides: Array<{ blob: MediaBlob; label: string }> = [];
  if (media.base !== null) sides.push({ blob: media.base, label: "Before" });
  if (media.head !== null) sides.push({ blob: media.head, label: "After" });

  return (
    <div className="flex flex-col gap-3 p-3 md:flex-row">
      {sides.map(({ blob, label }) => {
        const source = mediaSource(blob);
        const accessibleLabel = `${label} ${path}`;
        return (
          <figure key={label} className="flex min-w-0 flex-1 flex-col gap-2">
            <figcaption className="text-xs font-medium text-text-secondary">{label}</figcaption>
            {blob.media_type.startsWith("image/") ? (
              <img
                src={source}
                alt={accessibleLabel}
                loading="lazy"
                decoding="async"
                className="max-h-[48rem] w-full rounded-md border border-border-subtle bg-surface-1 object-contain"
              />
            ) : (
              <video
                src={source}
                aria-label={accessibleLabel}
                controls
                playsInline
                preload="metadata"
                className="max-h-[48rem] w-full rounded-md border border-border-subtle bg-surface-1 object-contain"
              />
            )}
          </figure>
        );
      })}
    </div>
  );
}
