import { Icon, IconButton } from "@otomat/ui";
import { plural } from "@web/lib/plural";
import type { ComposerImage } from "@web/lib/run/composer-images";

export function ComposerImages({
  images,
  onRemove,
}: {
  images: readonly ComposerImage[];
  onRemove: (index: number) => void;
}) {
  return (
    // Containing block: the sr-only status otherwise inflates ancestor scroll height.
    <div className="relative flex flex-col gap-1.5">
      <span role="status" aria-live="polite" className="sr-only">
        {images.length === 0
          ? "No image attached."
          : `${plural(images.length, "image")} attached, ready to send.`}
      </span>
      {images.length === 0 ? null : (
        <ul aria-label="Attached images" className="flex flex-wrap gap-2">
          {images.map((image, index) => (
            <li key={image.url} className="relative">
              <img
                src={image.url}
                alt={`Attachment ${index + 1}`}
                className="size-16 rounded-md border border-border-subtle object-cover"
              />
              <IconButton
                size="sm"
                variant="outline"
                label={`Remove attachment ${index + 1}`}
                icon={<Icon name="x" aria-hidden />}
                className="absolute -top-2 -right-2 rounded-full bg-card"
                onClick={() => onRemove(index)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
