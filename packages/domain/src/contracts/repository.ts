import { z } from "zod";

import { projectContractSchema, repositoryContractSchema } from "./entities/workspace.js";

/** Why a local path was refused as a repository registration; safe to show verbatim in the UI. */
export const REPOSITORY_REGISTRATION_ERRORS = [
  "path_not_absolute",
  "path_not_found",
  "path_not_directory",
  "path_not_git_repository",
  "path_not_repository_root",
  "head_detached",
  "default_branch_undetectable",
  "repository_already_registered",
  "project_not_found",
  "project_already_has_repository",
] as const;
export type RepositoryRegistrationError = (typeof REPOSITORY_REGISTRATION_ERRORS)[number];

export const registerRepositoryRequestSchema = z.object({
  path: z.string().trim().min(1),
  /** Attaches the path to this existing project so its issues stay bound to it, instead of creating a new project. */
  project_id: z.string().min(1).optional(),
});
export type RegisterRepositoryRequest = z.infer<typeof registerRepositoryRequestSchema>;

/** Replaces the repository's worktree init commands; each entry is one shell command. */
export const updateRepositoryRequestSchema = z.object({
  init_commands: z.array(z.string().trim().min(1).max(500)).max(25),
});
export type UpdateRepositoryRequest = z.infer<typeof updateRepositoryRequestSchema>;

/** Local branches a run can fork from, newest-committed first, with the repository's own default. */
export const repositoryBranchesResponseSchema = z.object({
  default_branch: z.string(),
  branches: z.array(z.string()),
});
export type RepositoryBranchesResponse = z.infer<typeof repositoryBranchesResponseSchema>;

/** Successful registration materializes both the project and its repository. */
export const registerRepositoryResponseSchema = z.object({
  project: projectContractSchema,
  repository: repositoryContractSchema,
});

/** Stable refusal code plus a user-facing daemon message. */
export const repositoryRegistrationErrorSchema = z.object({
  error: z.enum(REPOSITORY_REGISTRATION_ERRORS),
  message: z.string(),
});

/** Why a repository deletion was refused; safe to show verbatim in the UI. */
export const REPOSITORY_DELETION_ERRORS = [
  "repository_not_found",
  "repository_has_active_runs",
] as const;

export const repositoryDeletionErrorSchema = z.object({
  error: z.enum(REPOSITORY_DELETION_ERRORS),
  message: z.string(),
});
