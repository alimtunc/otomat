import { Dialog, DialogContent, DialogTitle, DialogTrigger, FOCUS_RING } from "@otomat/ui";

export interface MediaLightboxProps {
  src: string;
  label: string;
}

export function MediaLightbox({ src, label }: MediaLightboxProps) {
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Enlarge ${label}`}
            className={`cursor-zoom-in rounded-md ${FOCUS_RING}`}
          >
            <img
              src={src}
              alt={label}
              decoding="async"
              className="max-h-[36rem] max-w-full rounded-md border border-border-subtle object-contain"
            />
          </button>
        }
      />
      <DialogContent className="w-auto max-w-[94vw] p-2">
        <DialogTitle className="sr-only">{label}</DialogTitle>
        <img src={src} alt={label} className="max-h-[88vh] max-w-full object-contain" />
      </DialogContent>
    </Dialog>
  );
}
