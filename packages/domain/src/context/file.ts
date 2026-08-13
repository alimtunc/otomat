import { z } from "zod";

/** Each refusal is stated to the reader instead of the file being silently dropped. */
export const CONTEXT_FILE_REFUSALS = [
  "missing",
  "binary",
  "too_large",
  "outside_repository",
  "symlink",
  "unreadable",
] as const;
export type ContextFileRefusal = (typeof CONTEXT_FILE_REFUSALS)[number];

export const contextFileSchema = z.discriminatedUnion("state", [
  z.object({
    state: z.literal("read"),
    path: z.string(),
    bytes: z.number().int().nonnegative(),
    text: z.string(),
  }),
  z.object({
    state: z.literal("unavailable"),
    path: z.string(),
    reason: z.enum(CONTEXT_FILE_REFUSALS),
  }),
]);
export type ContextFile = z.infer<typeof contextFileSchema>;
