import { z } from "zod";

/** Create a local issue without launching a run. */
export const createIssueRequestSchema = z.object({
  project_id: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().optional(),
});
export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>;
