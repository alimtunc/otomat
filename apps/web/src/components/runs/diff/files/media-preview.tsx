import type { DiffFileBlob } from "@otomat/domain";
import { MediaBlob } from "@web/components/runs/diff/files/media-blob";
import type { FileMediaContext } from "@web/components/runs/diff/files/use-file-blobs";

export interface DiffMediaPreviewProps {
  path: string;
  media: FileMediaContext;
}

export function DiffMediaPreview({ path, media }: DiffMediaPreviewProps) {
  const sides: Array<{ blob: Extract<DiffFileBlob, { kind: "media" }>; label: string }> = [];
  if (media.base !== null) sides.push({ blob: media.base, label: "Before" });
  if (media.head !== null) sides.push({ blob: media.head, label: "After" });

  return (
    <div className="flex flex-col gap-3 p-3 md:flex-row">
      {sides.map(({ blob, label }) => (
        <figure key={label} className="flex min-w-0 flex-1 flex-col gap-2">
          <figcaption className="text-xs font-medium text-text-secondary">{label}</figcaption>
          <MediaBlob
            data={blob.data}
            mediaType={blob.media_type}
            label={`${label} ${path}`}
            className="max-h-[48rem] w-full"
          />
        </figure>
      ))}
    </div>
  );
}
