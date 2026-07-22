import { z } from "zod";

export const WORKTREE_STATUSES = ["active", "archived", "removed"] as const;
export const worktreeStatusSchema = z.enum(WORKTREE_STATUSES);
export type WorktreeStatus = (typeof WORKTREE_STATUSES)[number];

export const projectContractSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  root_path: z.string(),
});
export type ProjectContract = z.infer<typeof projectContractSchema>;

export const repositoryContractSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string().min(1),
  remote_url: z.string().nullable(),
  default_branch: z.string(),
});
export type RepositoryContract = z.infer<typeof repositoryContractSchema>;
