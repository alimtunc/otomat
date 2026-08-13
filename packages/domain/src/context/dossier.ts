import { z } from "zod";

import { contextProgressSchema } from "./progress.js";
import { contextSelectionSchema } from "./selection.js";
import { contextPullRequestSchema, contextWorkspaceSchema } from "./workspace.js";

/** Every part is read from this daemon's own records, so a session is never handed a way to reach a tracker. */
export const sessionContextSchema = z.object({
  version: z.literal(1),
  captured_at: z.iso.datetime(),
  selection: contextSelectionSchema,
  workspace: contextWorkspaceSchema.nullable(),
  pull_request: contextPullRequestSchema.nullable(),
  progress: contextProgressSchema.nullable(),
});
export type SessionContext = z.infer<typeof sessionContextSchema>;

/** `context` is null on a session that ran before contexts were captured. */
export const sessionContextResponseSchema = z.object({
  run_id: z.string(),
  agent_session_id: z.string(),
  context: sessionContextSchema.nullable(),
});
export type SessionContextResponse = z.infer<typeof sessionContextResponseSchema>;
