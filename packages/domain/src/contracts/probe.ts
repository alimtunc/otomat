import { z } from "zod";

/**
 * What a local, credential-free probe of an installed provider binary reported.
 * `ok` is the only status that may carry results; `unsupported` means this
 * version has no such capability, and `failed` that the probe itself did not
 * work. Neither of the last two ever yields an invented answer.
 */
export const PROBE_STATUSES = ["ok", "unsupported", "failed"] as const;
export const probeStatusSchema = z.enum(PROBE_STATUSES);
export type ProbeStatus = (typeof PROBE_STATUSES)[number];

/** A probe's verdict plus one line safe to render verbatim in the UI. */
export const binaryProbeSchema = z.object({
  status: probeStatusSchema,
  detail: z.string(),
});
export type BinaryProbe = z.infer<typeof binaryProbeSchema>;
