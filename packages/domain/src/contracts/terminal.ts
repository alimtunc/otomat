import { z } from "zod";

export const terminalToolSchema = z.enum(["claude", "codex"]);
export type TerminalTool = z.infer<typeof terminalToolSchema>;
export const TERMINAL_INPUT_MAX = 8192;
export const preparedWorkspaceResponseSchema = z.object({ workspace_id: z.string() });
export const terminalSessionSchema = z.object({
  id: z.string().uuid(),
  project_id: z.string(),
  issue_id: z.string().nullable(),
  worktree_id: z.string().nullable(),
  path: z.string(),
  branch: z.string(),
  started_at: z.string(),
  tool: terminalToolSchema.nullable(),
  state: z.enum(["running", "closing", "exited"]),
  exit_code: z.number().nullable(),
  signal: z.number().nullable(),
});
export type TerminalSession = z.infer<typeof terminalSessionSchema>;
export const terminalInventorySchema = z.object({
  instance: z.string().uuid().nullable(),
  sessions: z.array(terminalSessionSchema),
});
export type TerminalInventory = z.infer<typeof terminalInventorySchema>;
const issueTerminalOpenSchema = z
  .object({
    instance: z.string().uuid(),
    issue_id: z.string().min(1),
    run_id: z.string().min(1).nullable(),
    tool: terminalToolSchema.nullable(),
    context_hash: z.string().nullable(),
  })
  .strict();
export const terminalOpenSchema = z.union([
  issueTerminalOpenSchema,
  z
    .object({
      instance: z.string().uuid(),
      project_id: z.string().min(1),
      tool: terminalToolSchema.nullable(),
    })
    .strict(),
]);
export type TerminalOpenRequest = z.infer<typeof terminalOpenSchema>;
export const terminalIdentitySchema = z.object({ instance: z.string().uuid() }).strict();
export const terminalInputSchema = terminalIdentitySchema.extend({
  data: z.string().min(1).max(TERMINAL_INPUT_MAX),
});
export const terminalResizeSchema = terminalIdentitySchema.extend({
  cols: z.number().int().min(2).max(500),
  rows: z.number().int().min(2).max(200),
});
export const terminalOutputSchema = z.object({
  session: terminalSessionSchema,
  cursor: z.number().int().nonnegative(),
  truncated: z.boolean(),
  data: z.string(),
});
export const terminalPreviewSchema = z.object({
  executable: terminalToolSchema,
  argv: z.array(z.string()),
  context_hash: z.string(),
});
export type TerminalPreview = z.infer<typeof terminalPreviewSchema>;
