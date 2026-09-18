import { z } from "zod";

export const CONTRIBUTION_IMAGE_MEDIA_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
] as const;
export const contributionImageMediaTypeSchema = z.enum(CONTRIBUTION_IMAGE_MEDIA_TYPES);
export type ContributionImageMediaType = z.infer<typeof contributionImageMediaTypeSchema>;

/** Five megabytes is the largest image the Claude API accepts; a larger one would be refused after the upload instead of before it. */
export const CONTRIBUTION_IMAGE_LIMITS = { max_count: 4, max_bytes: 5 * 1024 * 1024 } as const;

/** One image a message carries: the daemon names it, so nothing of the client's file name or path survives. */
export const runContributionImageSchema = z.object({
  id: z.string().min(1),
  media_type: contributionImageMediaTypeSchema,
  size_bytes: z.number().int().positive(),
});
export type RunContributionImage = z.infer<typeof runContributionImageSchema>;

/** The whole request one image-carrying message may weigh, so an oversized upload is refused before it is buffered. */
export const CONTRIBUTION_IMAGES_BODY_LIMIT_BYTES =
  CONTRIBUTION_IMAGE_LIMITS.max_count * CONTRIBUTION_IMAGE_LIMITS.max_bytes + 256 * 1024;

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function startsWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((byte, index) => bytes[offset + index] === byte);
}

/** The type the bytes really are, never the one the file name claims; `null` is anything else. */
export function sniffContributionImageType(bytes: Uint8Array): ContributionImageMediaType | null {
  if (startsWith(bytes, PNG_SIGNATURE)) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return "image/gif";
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return "image/webp";
  }
  return null;
}

export const CONTRIBUTION_IMAGE_SNIFF_BYTES = 12;

export type ContributionImagesVerdict =
  | { ok: true; images: Omit<RunContributionImage, "id">[] }
  | { ok: false; message: string };

/** One verdict for the composer and the daemon, so the client never offers an upload the daemon would refuse. */
export function checkContributionImages(
  candidates: readonly { head: Uint8Array; size_bytes: number }[],
): ContributionImagesVerdict {
  if (candidates.length > CONTRIBUTION_IMAGE_LIMITS.max_count) {
    return {
      ok: false,
      message: `A message carries at most ${CONTRIBUTION_IMAGE_LIMITS.max_count} images.`,
    };
  }
  const images: Omit<RunContributionImage, "id">[] = [];
  for (const [index, candidate] of candidates.entries()) {
    const media_type = sniffContributionImageType(candidate.head);
    if (media_type === null) {
      return {
        ok: false,
        message: `Image ${index + 1} is not a PNG, JPEG, GIF or WebP image.`,
      };
    }
    if (candidate.size_bytes > CONTRIBUTION_IMAGE_LIMITS.max_bytes) {
      return {
        ok: false,
        message: `Image ${index + 1} is larger than ${CONTRIBUTION_IMAGE_LIMITS.max_bytes / (1024 * 1024)} MB.`,
      };
    }
    images.push({ media_type, size_bytes: candidate.size_bytes });
  }
  return { ok: true, images };
}
