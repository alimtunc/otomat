import {
  checkContributionImages,
  CONTRIBUTION_IMAGE_MEDIA_TYPES,
  CONTRIBUTION_IMAGE_SNIFF_BYTES,
  type RuntimeImageCapability,
} from "@otomat/domain";
import { hasText } from "@web/lib/form";

export const COMPOSER_IMAGE_ACCEPT = CONTRIBUTION_IMAGE_MEDIA_TYPES.join(",");

export function composerImageFiles(list: FileList | null): File[] {
  return list === null ? [] : [...list].filter((file) => file.type.startsWith("image/"));
}

/** A draft image and the object URL its thumbnail reads; released when the image leaves the draft. */
export interface ComposerImage {
  file: File;
  url: string;
}

type ComposerImagesVerdict = { ok: true; images: ComposerImage[] } | { ok: false; message: string };

async function head(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.slice(0, CONTRIBUTION_IMAGE_SNIFF_BYTES).arrayBuffer());
}

/** The daemon's own verdict, run on the file bytes before any upload, so a refusal never costs a round trip. */
export async function acceptComposerImages(
  current: readonly ComposerImage[],
  added: readonly File[],
): Promise<ComposerImagesVerdict> {
  const files = [...current.map((image) => image.file), ...added];
  const candidates = await Promise.all(
    files.map(async (file) => ({ head: await head(file), size_bytes: file.size })),
  );
  const verdict = checkContributionImages(candidates);
  if (!verdict.ok) return verdict;
  return {
    ok: true,
    images: [...current, ...added.map((file) => ({ file, url: URL.createObjectURL(file) }))],
  };
}

export function releaseComposerImages(images: readonly ComposerImage[]): void {
  for (const image of images) URL.revokeObjectURL(image.url);
}

export function composerImageRefusal(capability: RuntimeImageCapability | null): string | null {
  if (capability === null) return "Images cannot be sent right now.";
  return capability.status === "unsupported" ? capability.reason : null;
}

export function composerDraftSendable(
  capability: RuntimeImageCapability | null,
  body: string,
  imageCount: number,
): boolean {
  if (hasText(body)) return true;
  if (imageCount === 0 || capability?.status !== "supported") return false;
  return capability.standalone;
}
