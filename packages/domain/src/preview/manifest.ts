import { z } from "zod";

import { PREVIEW_BUILD_SHA } from "./instance.js";

/** Served from the web preview's own origin; its absence is what tells a build it is not a preview. */
export const PREVIEW_MANIFEST_PATH = "/preview.json";

export const previewManifestSchema = z.object({
  pull_request: z.number().int().positive(),
  build: z.string().regex(PREVIEW_BUILD_SHA),
});
export type PreviewManifest = z.infer<typeof previewManifestSchema>;
