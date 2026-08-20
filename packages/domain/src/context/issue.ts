import { z } from "zod";

import { ISSUE_STATES } from "../contracts/entity-states.js";

/** No external id and no credential: an imported Linear issue and a local one reach the session as the same shape. */
export const contextIssueSchema = z.object({
  id: z.string(),
  /** Tracker-facing identifier; null for a local issue. */
  identifier: z.string().nullable(),
  title: z.string(),
  body: z.string().nullable(),
  body_truncated: z.boolean(),
  status: z.enum(ISSUE_STATES),
  source: z.string(),
  source_state_name: z.string().nullable(),
  labels: z.array(z.string()),
  assignee: z.string().nullable(),
  priority: z.number().int().nullable(),
});
export type ContextIssue = z.infer<typeof contextIssueSchema>;
