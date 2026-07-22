import { z } from "zod";

export const completionEvidenceSchema = z.discriminatedUnion("source", [
  z
    .object({ source: z.literal("timeline"), seq: z.number().int().nonnegative().nullable() })
    .strict(),
  z.object({ source: z.literal("diff"), file_path: z.string().nullable() }).strict(),
  z.object({ source: z.literal("review"), comment_id: z.string().nullable() }).strict(),
  z.object({ source: z.literal("pull_request"), url: z.url().nullable() }).strict(),
  z.object({ source: z.literal("linear"), write_id: z.string() }).strict(),
]);
export type CompletionEvidence = z.infer<typeof completionEvidenceSchema>;

export const reportEvidenceSchema = z.array(completionEvidenceSchema).nonempty();

export const evidencedMessageSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    evidence: z.array(completionEvidenceSchema),
  })
  .strict();
