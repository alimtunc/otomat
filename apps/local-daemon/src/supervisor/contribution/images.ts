import { randomUUID } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { getRunContribution, type RunContributionRow } from "@otomat/db";
import {
  checkContributionImages,
  CONTRIBUTION_IMAGE_SNIFF_BYTES,
  type ContributionImageMediaType,
  type RunContributionImage,
  type RuntimeImageCapability,
} from "@otomat/domain";

import { runDir } from "#events";
import {
  describeRuntimeImageCapability,
  isKnownRuntimeId,
  readRuntimeImage,
  type RuntimeImageFile,
} from "#runtime";

import type { SupervisorState } from "../state.js";
import type { ContributionImageContent } from "../types.js";

/** Refused before anything is written: the runtime cannot take images, or an upload is not one the daemon accepts. */
export class RunContributionImageError extends Error {
  constructor(
    readonly code: "images_unsupported" | "image_invalid",
    message: string,
  ) {
    super(message);
    this.name = "RunContributionImageError";
  }
}

const EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
} satisfies Record<ContributionImageMediaType, string>;

function imagesDir(dataDir: string, runId: string): string {
  return join(runDir(dataDir, runId), "images");
}

function contributionImageFile(
  dataDir: string,
  runId: string,
  image: RunContributionImage,
): RuntimeImageFile {
  return {
    path: join(imagesDir(dataDir, runId), `${image.id}.${EXTENSIONS[image.media_type]}`),
    media_type: image.media_type,
  };
}

export function contributionImageFiles(
  dataDir: string,
  rows: readonly RunContributionRow[],
): RuntimeImageFile[] {
  return rows.flatMap((row) =>
    row.images_json.map((image) => contributionImageFile(dataDir, row.run_id, image)),
  );
}

/** A runtime the plan froze but this daemon no longer knows cannot take an image either way; the resume path reports that separately. */
export function requireImageCapability(runtime: string, body: string): void {
  const capability: RuntimeImageCapability = isKnownRuntimeId(runtime)
    ? describeRuntimeImageCapability(runtime)
    : { status: "unsupported", reason: `unknown runtime "${runtime}"` };
  if (capability.status === "unsupported") {
    throw new RunContributionImageError("images_unsupported", capability.reason);
  }
  if (body.length === 0 && !capability.standalone) {
    throw new RunContributionImageError(
      "images_unsupported",
      "This runtime needs a text message next to an image.",
    );
  }
}

/** A refusal or a failed write leaves nothing behind. */
export function storeContributionImages(
  dataDir: string,
  runId: string,
  uploads: readonly Uint8Array[],
): RunContributionImage[] {
  const verdict = checkContributionImages(
    uploads.map((bytes) => ({
      head: bytes.subarray(0, CONTRIBUTION_IMAGE_SNIFF_BYTES),
      size_bytes: bytes.byteLength,
    })),
  );
  if (!verdict.ok) throw new RunContributionImageError("image_invalid", verdict.message);
  const entries = verdict.images.map((accepted, index) => ({
    image: { ...accepted, id: randomUUID() },
    bytes: uploads[index],
  }));
  if (entries.length > 0) mkdirSync(imagesDir(dataDir, runId), { recursive: true });
  const written: RunContributionImage[] = [];
  try {
    for (const { image, bytes } of entries) {
      writeFileSync(contributionImageFile(dataDir, runId, image).path, bytes, { flag: "wx" });
      written.push(image);
    }
  } catch (error) {
    removeContributionImages(dataDir, runId, written);
    throw error;
  }
  return written;
}

export function removeContributionImages(
  dataDir: string,
  runId: string,
  images: readonly RunContributionImage[],
): void {
  for (const image of images) {
    rmSync(contributionImageFile(dataDir, runId, image).path, { force: true });
  }
}

export function contributionImageContent(
  state: SupervisorState,
  runId: string,
  contributionId: string,
  imageId: string,
): ContributionImageContent | null {
  const row = getRunContribution(state.db, contributionId);
  if (!row || row.run_id !== runId) return null;
  const image = row.images_json.find((candidate) => candidate.id === imageId);
  if (image === undefined) return null;
  return {
    media_type: image.media_type,
    bytes: readRuntimeImage(contributionImageFile(state.dataDir, row.run_id, image)),
  };
}
