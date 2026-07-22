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
] as const;
export type RepositoryRegistrationError = (typeof REPOSITORY_REGISTRATION_ERRORS)[number];

/** Local filesystem path submitted for repository registration. */
export const registerRepositoryRequestSchema = z.object({
  path: z.string().trim().min(1),
});
export type RegisterRepositoryRequest = z.infer<typeof registerRepositoryRequestSchema>;

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
