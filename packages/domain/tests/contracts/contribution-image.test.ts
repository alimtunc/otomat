import { expect, it } from "vitest";

import {
  checkContributionImages,
  CONTRIBUTION_IMAGE_LIMITS,
  sniffContributionImageType,
} from "#domain/contracts/contribution-image";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
const GIF = new TextEncoder().encode("GIF89a......");
const WEBP = new TextEncoder().encode("RIFF....WEBP");

it("names the type from the bytes and nothing else", () => {
  expect(sniffContributionImageType(PNG)).toBe("image/png");
  expect(sniffContributionImageType(JPEG)).toBe("image/jpeg");
  expect(sniffContributionImageType(GIF)).toBe("image/gif");
  expect(sniffContributionImageType(WEBP)).toBe("image/webp");
  expect(sniffContributionImageType(new TextEncoder().encode("RIFF....WAVE"))).toBeNull();
  expect(sniffContributionImageType(new TextEncoder().encode("<svg/>"))).toBeNull();
  expect(sniffContributionImageType(new Uint8Array())).toBeNull();
});

it("accepts a set within the limits and refuses the first offender by its position", () => {
  expect(
    checkContributionImages([
      { head: PNG, size_bytes: 10 },
      { head: WEBP, size_bytes: CONTRIBUTION_IMAGE_LIMITS.max_bytes },
    ]),
  ).toEqual({
    ok: true,
    images: [
      { media_type: "image/png", size_bytes: 10 },
      { media_type: "image/webp", size_bytes: CONTRIBUTION_IMAGE_LIMITS.max_bytes },
    ],
  });
  expect(
    checkContributionImages([
      { head: PNG, size_bytes: 10 },
      { head: JPEG, size_bytes: CONTRIBUTION_IMAGE_LIMITS.max_bytes + 1 },
    ]),
  ).toEqual({ ok: false, message: "Image 2 is larger than 5 MB." });
  expect(checkContributionImages([{ head: GIF.subarray(0, 2), size_bytes: 1 }])).toEqual({
    ok: false,
    message: "Image 1 is not a PNG, JPEG, GIF or WebP image.",
  });
  expect(
    checkContributionImages(
      Array.from({ length: CONTRIBUTION_IMAGE_LIMITS.max_count + 1 }, () => ({
        head: PNG,
        size_bytes: 1,
      })),
    ),
  ).toEqual({ ok: false, message: "A message carries at most 4 images." });
});
